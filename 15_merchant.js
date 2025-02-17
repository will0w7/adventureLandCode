game_log("---Merchant Script Start---");
if (get_active_characters()[character.name] === 'self') load_code(2);
let lastBankCheck, potionsNeeded, state, lastAttemptedCrafting, craftingItem, currentTask, craftingLevel,
    exchangeTarget,
    exchangeNpc, exchangeAmount, playerSale, saleCooldown, lastRestock, buyCooldown, //deathCooldown,
    getItem, sellItem;
//let deathTracker = 0;
//let deathTime = {};
let passiveSale = {};
let sellItems = [];

//State Controller
setInterval(function () {
    state = merchantStateController(state);
}, 7500);

//Primary Loop
setInterval(function () {
    if (is_moving(character)) closeStand(); else placeStand();
    // Update your data
    updateCharacterData();
    if (character.rip) state = 99;
    if (!state) return;
    if (!merchantStateTasks(state)) merchantTaskManager();
}, 800);

//MERCHANT TASKS
function merchantTaskManager() {
    if (!buyCooldown) buyCooldown = Date.now();
    potionController();
    if (!lastBankCheck) return bookKeeping();
    if (isPvP() && nearbyAggressors(600).length) {
        set_message('Fleeing');
        return shibMove('bank')
    }
    if (standCheck()) return;
    if (exchangeStuff()) return;
    if (sellExcessToNPC()) return;
    if (craftingItem || !lastAttemptedCrafting || lastAttemptedCrafting + (60000 * 10) < Date.now()) {
        combineItems();
    } else {
        if (!getItem && !craftingItem && !exchangeTarget && !currentTask) if (character.map === 'bank') return shibMove('main'); else if (!distanceToPoint(69, 12) || distanceToPoint(69, 12) > 15) return shibMove(69, 12);
        if (!sellItemsToPlayers() && buyFromPlayers()) { //  && !buyFromPonty()
            // buyBaseItems();
            snipePonty();
            buyCheapStuff();
            passiveMerchant();
        }
    }
}

// PLAYER TRADING
// Sell to player buy orders that are better than 60% (the npc markdown)
function sellItemsToPlayers() {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    let priceDetails = JSON.parse(localStorage.getItem('priceDetails'));
    if (currentTask === 'getItem' && !getInventorySlot(playerSale.item, false, playerSale.level)) withdrawItem(playerSale.item, playerSale.level);
    if (character.map === 'bank') return shibMove('main');
    let merchants = Object.values(parent.entities).filter(mob => is_character(mob) && mob.ctype === "merchant" && mob.name !== character.name && mob.stand);
    if (saleCooldown + 2500 > Date.now()) return false;
    for (let buyers of merchants) {
        for (let s = 1; s <= 16; s++) {
            let slot = buyers.slots['trade' + s];
            let theBookName;
            if (slot && slot.b) {
                theBookName = slot.name + slot.level;
                if (noSell.includes(slot.name)) continue;
                if (!bankDetails[theBookName] && !getInventorySlot(slot.name, false, slot.level)) continue;
                let goodPrice = G.items[slot.name].g;
                if (priceDetails && priceDetails[slot.name + slot.level] && priceDetails[slot.name + slot.level].bavg) goodPrice = round(priceDetails[slot.name + slot.level].bavg);
                if (slot.price < goodPrice) continue;
                if (combineTargets.includes(slot.name) && (bankDetails[theBookName] || 0 + getInventorySlot(slot.name, true, slot.level).length) < 4) continue;
                if (upgradeTargets.includes(slot.name) && (bankDetails[theBookName] || 0 + getInventorySlot(slot.name, true, slot.level).length) < 2) continue;
                set_message('SellingPlayer');
                if (getInventorySlot(slot.name, false, slot.level)) {
                    currentTask = undefined;
                    playerSale = undefined;
                    saleCooldown = Date.now();
                    game_log("Item Sold: " + slot.name);
                    game_log("To: " + buyers.name);
                    game_log("Price: " + slot.price);
                    pm(buyers.name, 'Enjoy the ' + slot.name + ' ~This is an automated message~');
                    parent.socket.emit("trade_sell", { slot: 'trade' + s, id: buyers.id, rid: slot.rid, q: 1 });
                } else {
                    game_log("Grabbing to sell - " + slot.name);
                    playerSale = { item: slot.name, level: slot.level, rid: slot.rid };
                    currentTask = 'getItem';
                    withdrawItem(slot.name, slot.level)
                }
                return true;
            }
        }
    }
    return false;
}

// Handles the merchant stand
function passiveMerchant() {
    // No idle on pvp realms
    if (isPvP()) return lastAttemptedCrafting = undefined;
    set_message('IdleMerchant');
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    let priceDetails = JSON.parse(localStorage.getItem('priceDetails'));
    if (currentTask === 'getPassiveItem' && !getInventorySlot(passiveSale.item, false, passiveSale.level)) {
        withdrawItem(passiveSale.item, passiveSale.level);
    }
    if (character.map === 'bank') return shibMove('main');
    let listedItems = [];
    let emptySlots = [];
    for (let s = 1; s <= 16; s++) {
        let slot = character.slots['trade' + s];
        if (slot && slot.name) listedItems.push(slot.name); else if (!slot) emptySlots.push('trade' + s);
    }
    if (passiveSale.item && getInventorySlot(passiveSale.item, false, passiveSale.level)) {
        let append = passiveSale.level;
        if (!passiveSale.level) append = '';
        let scrollCost = passiveSale.level * 70000;
        if (G.items[passiveSale.item].compound) scrollCost = passiveSale.level * 600000;
        let rawPrice = G.items[passiveSale.item].g + scrollCost;
        let historicalPrice, price;
        if (priceDetails && priceDetails[passiveSale.item + append] && priceDetails[passiveSale.item + append].savg) historicalPrice = round(priceDetails[passiveSale.item + append].savg);
        if (!historicalPrice || historicalPrice < rawPrice) price = rawPrice; else price = historicalPrice;
        character.slots[emptySlots[0]] = 'holder';
        trade(getInventorySlot(passiveSale.item, false, passiveSale.level), emptySlots[0], price, 1);
        whisperParty(G.items[passiveSale.item].name + ' listed for ' + price);
        game_log(G.items[passiveSale.item].name + ' listed for ' + price);
        listedItems.push(passiveSale.item);
        passiveSale = {};
        currentTask = undefined;
    } else if (emptySlots.length) {
        for (let item of sellList) {
            // Skip if we're already selling one
            if (listedItems.includes(item)) continue;
            for (let l = 0; l < 10; l++) {
                if (bankDetails[item + l]) {
                    passiveSale.item = item;
                    passiveSale.level = l;
                    currentTask = 'getPassiveItem';
                    return;
                }
            }
        }
        // Sell high level items in excess
        for (let key of Object.keys(bankDetails)) {
            let level = parseInt(key[key.length - 1]);
            let cleanName = key.slice(0, -1);
            if (!G.items[cleanName]) continue;
            if (listedItems.includes(cleanName)) continue;
            if (level < normalLevelTarget - 1) continue;
            let amount = bankDetails[key];
            let minimum = 1;
            if (G.items[cleanName] && G.items[cleanName].compound) minimum = 3;
            if (amount > minimum) {
                passiveSale.item = cleanName;
                passiveSale.level = level;
                currentTask = 'getPassiveItem';
                return;
            }
        }
        for (let item of buyTargets) {
            if (bankDetails['gold'] + character.gold < 5000000) break;
            let append = item.level;
            if (!item.level) append = '';
            let price = G.items[item.item].g;
            if (priceDetails && priceDetails[item.item + append] && priceDetails[item.item + append].savg) price = round(priceDetails[item.item + append].bavg);
            // Skip if we have enough
            if (bankDetails[item.item + 0] >= item.amount) continue;
            // Skip if we're already buying one
            if (listedItems.includes(item.item)) continue;
            parent.socket.emit("trade_wishlist", {
                q: item.amount,
                slot: emptySlots[0],
                price: price,
                level: item.level || 0,
                name: item.item
            });
            whisperParty(G.items[item.item].name + ' wishlisted for ' + G.items[item.item].g);
            game_log(G.items[item.item].name + ' wishlisted for ' + G.items[item.item].g);
        }
    }
}

//Snipe Ponty for wanted items
function snipePonty() {
    if (character.map === 'bank') return shibMove('main');
    parent.socket.emit("secondhands");
    parent.secondhands.forEach(item => {
        if (wantedItems.includes(item.name)
            && character.gold >= parent.calculate_item_value(item) * 2 * (item.q ?? 1)) parent.socket.emit("sbuy", { "rid": item.rid });
    });
}

//Buy items form Ponty
function buyFromPonty() {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    if (bankDetails['gold'] + character.gold < 5000000) return;
    if (character.map === 'bank') return shibMove('main');
    //Open Ponty UI to refresh data
    parent.socket.emit("secondhands");
    let items = parent.secondhands;
    if (buyCooldown + 1000 > Date.now()) return false;
    for (let s = 0; s < items.length; s++) {
        let item = items[s];
        if (item) {
            for (let it of wantedItems) {
                if (it !== item.name) continue;
                parent.socket.emit("sbuy", { "rid": item.rid });
                set_message('BuyingPonty');
                buyCooldown = Date.now();
                game_log("Item Bought: " + it.name);
                game_log("From: Ponty");
                game_log("Price: " + item.price);
                return true;
            }
        }
    }
    return false;
}

function buyCheapStuff() {
    for (const i in parent.entities) {
        const otherPlayer = parent.entities[i];
        if (otherPlayer.player
            && otherPlayer.ctype === "merchant"
            && otherPlayer.slots
            //&& distance(character, otherPlayer) < G.skills.mluck.range
        ) {

            const tradeSlots = Object.keys(otherPlayer.slots).filter(tradeSlot => tradeSlot.includes("trade"));
            tradeSlots.forEach(tradeSlot => {
                const otherPlayerTradeSlot = otherPlayer.slots[tradeSlot];
                //Must be a Trade-Slot
                if (otherPlayerTradeSlot) {
                    if (!otherPlayerTradeSlot.b //Excludes "whishlisted" items! Trade slots can "sell" or "wishlist"!
                        && otherPlayerTradeSlot.price < item_value(otherPlayerTradeSlot)
                        && character.gold > otherPlayerTradeSlot.price
                        //Don't try to buy Giveaways
                        && !otherPlayerTradeSlot.giveaway) {
                        //If it's a single item, buy it.
                        if (!otherPlayerTradeSlot.q) {
                            game_log(`Bought 1 ${otherPlayerTradeSlot.name} from ${otherPlayer.name}`);
                            trade_buy(otherPlayer, tradeSlot, 1);
                            //If the item has a quantity, buy as many as possible
                        } else if (otherPlayerTradeSlot.q) {
                            //Maximum possible quantity of items that can be bought wit available gold
                            let maxBuy = Math.floor(character.gold / otherPlayerTradeSlot.price) < otherPlayerTradeSlot.q ? Math.floor(character.gold / otherPlayerTradeSlot.price) : otherPlayerTradeSlot.q;
                            trade_buy(otherPlayer, tradeSlot, maxBuy);
                            //parent.trade_buy(tradeSlot, otherPlayer.name, otherPlayerTradeSlot.rid, maxBuy);
                        }
                        //Auto-Join Giveaways
                    } else if (otherPlayerTradeSlot.giveaway
                        && !otherPlayerTradeSlot.list.includes(character.name)) {
                        parent.socket.emit('join_giveaway', {
                            slot: tradeSlot,
                            id: otherPlayer.id,
                            rid: otherPlayerTradeSlot.rid,
                        });
                        log("Joined giveaway!");
                    }
                }
            });
        }
    }
}

// Sell to player buy orders that are better than 60% (the npc markdown)
function buyFromPlayers() {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    let priceDetails = JSON.parse(localStorage.getItem('priceDetails'));
    if (bankDetails['gold'] + character.gold < 5000000) return;
    if (character.map === 'bank') return shibMove('main');
    let merchants = Object.values(parent.entities).filter(mob => is_character(mob) && mob.ctype === "merchant" && mob.name !== character.name && mob.stand);
    if (buyCooldown + 2500 > Date.now()) return false;
    for (let sellers of merchants) {
        for (let s = 1; s <= 16; s++) {
            let slotName = 'trade' + s;
            let slot = sellers.slots[slotName];
            if (slot && !slot.b) {
                let goodPrice = G.items[slot.name].g * 1.2;
                if (priceDetails && priceDetails[slot.name + slot.level] && priceDetails[slot.name + slot.level].savg) goodPrice = round(priceDetails[slot.name + slot.level].savg);
                if (slot.price > goodPrice || slot.price > (bankDetails['gold'] + character.gold) * 0.015) continue;
                // Buy from the passive list
                for (let item of buyTargets) {
                    if (item.item !== slot.name) continue;
                    // If we have the item continue
                    if (bankDetails[item.item] >= item.amount || getInventorySlot(item.item)) continue;
                    trade_buy(sellers, slotName); // target needs to be an actual player
                    set_message('BuyingPlayer');
                    buyCooldown = Date.now();
                    game_log("Item Bought: " + slot.name);
                    game_log("From: " + sellers.name);
                    game_log("Price: " + slot.price);
                    pm(sellers.name, 'Thanks for the ' + slot.name + ' ~This is an automated message~');
                    return true;
                }
                // Buy from the combine/upgrade lists when needed
                let craftingNeeds = combineTargets.concat(upgradeTargets);
                for (let item of craftingNeeds) {
                    if (item !== slot.name) continue;
                    // If we have enough of the item continue
                    let needed = 2;
                    if (G.items[item].compound) needed = 4;
                    if (totalInBank(item) >= needed) continue;
                    trade_buy(sellers, slotName); // target needs to be an actual player
                    set_message('BuyingPlayer');
                    buyCooldown = Date.now();
                    game_log("Item Bought: " + slot.name);
                    game_log("From: " + sellers.name);
                    game_log("Price: " + slot.price);
                    pm(sellers.name, 'Thanks for the ' + slot.name + ' ~This is an automated message~');
                    return true;
                }
            }
        }
    }
    return false;
}

// NPC STUFF
// Exchange Items
function exchangeStuff() {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    if (!bankDetails) return;
    if (!exchangeTarget) {
        for (let item of exchangeItems) {
            let minimum = 1;
            if (item.amount) minimum = item.amount;
            if (bankDetails[item.item + 0] >= minimum) {
                exchangeTarget = item.item;
                exchangeNpc = item.npc;
                exchangeAmount = item.amount;
                return true;
            }
        }
    } else {
        set_message('Exchanging');
        if (!exchangeAmount) exchangeAmount = 1;
        if (itemCount(exchangeTarget) >= exchangeAmount) {
            exchangeItem(exchangeTarget, exchangeNpc);
        } else if (bankDetails[exchangeTarget + 0] >= exchangeAmount) {
            let withdraw = withdrawItem(exchangeTarget);
            if (withdraw === null) {
                exchangeTarget = undefined;
                exchangeNpc = undefined;
            }
        } else {
            exchangeTarget = undefined;
            exchangeNpc = undefined;
        }
        return true;
    }
}

// Buy items for crafting
function buyBaseItems() {
    if (lastRestock + 60000 * 60 > Date.now()) return;
    let baseItems = ['bow', 'helmet', 'shoes', 'gloves', 'pants', 'coat', 'blade', 'claw', 'staff', 'wshield'];
    for (let item of baseItems) {
        if (totalInBank(item) < 4) {
            set_message('Restocking');
            game_log('RESTOCK: Bought a ' + item + ' as we only had ' + totalInBank(item) + ' of them.');
            buy(item, 1);
        }
    }
    lastRestock = Date.now();
}

// Sell overflow
function sellExcessToNPC() {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    if (!bankDetails) return;
    // Set bank items for sale if overstocked
    if (sellItem) {
        if (character.map !== 'main') {
            shibMove('main');
            return true;
        }
        set_message('SellingNPC');
        let slot = getInventorySlot(sellItem);
        if (slot) sell(slot, 1);
        sellItem = undefined;
        return true;
    } else if (getItem) {
        switch (withdrawItem(getItem)) {
            case true:
                sellItem = getItem;
                getItem = undefined;
                break;
            case false:
                break;
            case null:
                getItem = undefined;
                break;
        }
        return true;
    } else {
        for (let item of trashItems) {
            if (!totalInBank(item)) continue;
            getItem = item;
            return true;
        }
        if (!getItem) return false;
    }
}

//UPGRADING and COMBINING
function combineItems() {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    if (!craftingItem) {
        for (let item of combineTargets) {
            for (let l = normalLevelTarget; l >= 0; l--) {
                if (item_grade({
                    name: item,
                    level: l
                }) === 1 && l > highLevelTarget) continue; else if (item_grade({
                    name: item,
                    level: l
                }) === 2 && l > epicLevelTarget) continue;
                let append = l;
                let levelLookup = l;
                if (!l) {
                    append = 0;
                    levelLookup = undefined;
                }
                let stock = 3;
                if (l + 1 === normalLevelTarget) stock = 4;
                if (getInventorySlot(item, true, levelLookup).length >= stock || bankDetails[item + append] >= stock) {
                    craftingItem = item;
                    currentTask = 'combine';
                    craftingLevel = l;
                    lastAttemptedCrafting = undefined;
                    return;
                }
            }
        }
        for (let item of upgradeTargets) {
            for (let l = normalLevelTarget; l >= 0; l--) {
                if (item_grade({
                    name: item,
                    level: l
                }) === 1 && l > highLevelTarget) continue; else if (item_grade({
                    name: item,
                    level: l
                }) === 2 && l > epicLevelTarget) continue;
                let append = l;
                let levelLookup = l;
                if (!l) {
                    levelLookup = undefined;
                    append = 0;
                }
                let stock = 1;
                if (l + 1 === normalLevelTarget) stock = 2;
                if (getInventorySlot(item, true, levelLookup).length >= stock || bankDetails[item + append] >= stock) {
                    craftingItem = item;
                    currentTask = 'upgrade';
                    craftingLevel = l;
                    lastAttemptedCrafting = undefined;
                    return;
                }
            }
        }
        lastAttemptedCrafting = Date.now();
    } else {
        set_message('Crafting');
        let needed = 1;
        if (currentTask === 'combine') needed = 3;
        if (itemCount(craftingItem, craftingLevel) >= needed) {
            let scroll;
            let componentSlot = getInventorySlot(craftingItem, true, craftingLevel);
            let grade = item_grade(character.items[componentSlot[0]]);
            if (currentTask === 'combine') {
                if (grade === 0 && craftingLevel < 7) scroll = 'cscroll0'; else if (grade === 0 && craftingLevel >= 7) scroll = 'cscroll1'; else if (grade === 1) scroll = 'cscroll1'; else if (grade === 2) scroll = 'cscroll2';
            } else {
                if (grade === 0 && craftingLevel < 7) scroll = 'scroll0'; else if (grade === 0 && craftingLevel >= 7) scroll = 'scroll1'; else if (grade === 1) scroll = 'scroll1'; else if (grade === 2) scroll = 'scroll2';
            }
            if (itemCount(scroll)) {
                let scrollSlot = getInventorySlot(scroll);
                if (crafting(currentTask, componentSlot, scrollSlot)) {
                    craftingItem = undefined;
                    currentTask = undefined;
                    craftingLevel = undefined;
                    lastAttemptedCrafting = undefined;
                }
            } else {
                if (bankDetails[scroll]) {
                    withdrawItem(scroll);
                } else {
                    buyScroll(scroll);
                }
            }
        } else {
            let withdraw = withdrawItem(craftingItem, craftingLevel);
            if (withdraw === null) {
                bankDetails[craftingItem] = undefined;
                craftingItem = undefined;
                currentTask = undefined;
                craftingLevel = undefined;
                lastBankCheck = undefined;
                lastAttemptedCrafting = undefined;
            }
        }
    }
}

//Mass Production
function massProduction() {
    if (character.level >= 60
        && character.mp > G.skills.massproductionpp.mp
        && !is_on_cooldown("massproductionpp")) {
        use_skill("massproductionpp");
        game_log("Used Mass Production 90%");
    } else if (character.level >= 30
        && character.mp > G.skills.massproduction.mp
        && !is_on_cooldown("massproduction")) {
        use_skill("massproduction");
        game_log("Used Mass Production 50%");
    }
}

// Go buy a stand
function standCheck() {
    if (!getInventorySlot('stand0') && !localStorage.getItem('bankDetails')['stand0']) {
        let standsMerchant = getNpc("standmerchant");
        let distanceToMerchant = null;
        if (standsMerchant != null) distanceToMerchant = distanceToPoint(standsMerchant.position[0], standsMerchant.position[1]);
        if (!smart.moving && (distanceToMerchant == null || distanceToMerchant > 150 || character.map !== 'main')) return smart_move({ to: "stands" });
        if (distanceToMerchant != null && distanceToMerchant < 155) {
            buy('stand0', 1);
        }
        return true;
    }
}

//Get bank information
function bookKeeping() {
    set_message('Bookkeeping');
    let bankDetails = {};
    if (character.map !== 'bank') {
        shibMove('bank');
    } else {
        depositItems();
        for (let key in Object.values(character.id)) {
            let slot = Object.values(character.id)[key];
            if (!slot || !slot.length) continue;
            for (let packKey in slot) {
                let banker = slot[packKey];
                if (!banker) continue;
                if (!item_properties(banker)) continue;
                let level = item_properties(banker).level;
                if (!level) level = 0;
                let quantity = banker.q || 1;
                if (bankDetails[banker.name + level]) {
                    bankDetails[banker.name + level] += quantity;
                } else {
                    bankDetails[banker.name + level] = quantity;
                }
            }
        }
        bankDetails['gold'] = character.id['gold'];
        lastBankCheck = Date.now();
        localStorage.removeItem('bankDetails');
        localStorage.setItem('bankDetails', JSON.stringify(bankDetails));
        return bankDetails;
    }
}

//Crafting
function crafting(task, componentSlot, scrollSlot) {
    if (currentTask === 'combine' || currentTask === 'upgrade') {
        let upgradeMerchant = getNpc("newupgrade");
        let distanceToMerchant = null;
        if (upgradeMerchant != null) distanceToMerchant = distanceToPoint(upgradeMerchant.position[0], upgradeMerchant.position[1]);
        if (!smart.moving && (distanceToMerchant == null || distanceToMerchant > 350 || character.map !== 'main')) return smart_move({ to: "upgrade" });
        if (distanceToMerchant != null && distanceToMerchant < 355) {
            massProduction();
            if (currentTask === 'combine') compound(componentSlot[0], componentSlot[1], componentSlot[2], scrollSlot); else upgrade(componentSlot[0], scrollSlot);
            return true;
        }
    }
}

////MERCHANT TASK MANAGER
//State tasks
function merchantStateTasks(state) {
    switch (state) {
        // Death
        case 99: {
            let tod = deathTime[character.name];
            if (isPvP() && !deathCooldown) deathCooldown = getRndInteger(15000, 35000); else deathCooldown = 15000;
            if (tod + deathCooldown < Date.now() || Math.random() > 0.9) respawn();
            return true;
        }
        // Wallet refill
        case 12: {
            withdrawGold(spendingAmount - character.gold);
            return true;
        }
        // Deposit
        case 2: {
            depositGold(Number.MAX_SAFE_INTEGER);
            withdrawGold(spendingAmount);
            depositItems();
            return true;
        }
        // Sales
        case 9: {
            sell();
            return;
        }
        // Accounting
        case 11: {
            bookKeeping();
            if (localStorage.getItem('bankDetails') && lastBankCheck) {
                lastBankCheck = Date.now();
            } else {
                return true;
            }
        }
    }
}

// State controller
let walletTarget;
function merchantStateController(state) {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    if (bankDetails && bankDetails['gold'] < spendingAmount) walletTarget = bankDetails['gold'] / 2;
    let new_state = 9;
    //KIA
    if (character.rip) {
        if (state !== 99) {
            deathTime[character.name] = Date.now();
            if (isPvP()) deathTracker++;
            whisperParty('I died');
        }
        new_state = 99;
    } //ACCOUNTING
    else if (!bankDetails || !lastBankCheck || lastBankCheck + 900000 < Date.now()) {
        new_state = 11;
    } //NO POORS
    else if (character.gold < walletTarget * 0.25) {
        new_state = 12;
    } // Deposits
    else if (character.gold >= spendingAmount * 2) {
        new_state = 2;
    }   //POTION RESTOCK
    else if (potionsNeeded) {
        new_state = 8;
    }
    //If state changed set it and announce
    if (state !== new_state) {
        game_log("--- NEW STATE " + states[new_state] + " ---");
        state = new_state;
    }
    return state;
}

// Luck loop
/*setInterval(function () {
    if (Math.random() > 0.75) return;
    let entity = parent.entities[random_one(Object.keys(parent.entities))];
    if (is_character(entity)) {
        use('mluck', entity, true);
        game_log('LUCKED - ' + entity.name);
    }
}, 2500); */

setInterval(merchantsLuck, 1000);

//Buff other characters with Merchants Luck!
function merchantsLuck() {
	let otherPlayers = [];
	for (i in parent.entities) {
		if (parent.entities[i].player
			&& parent.entities[i].ctype
			&& !parent.entities[i].rip
			&& !parent.entities[i].npc
			&& (!parent.entities[i].s.mluck
				|| parent.entities[i].s.mluck.strong === false)
			/*
			&& (!parent.entities[i].s.mluck
			 || !parent.entities[i].s.mluck.f
			 || parent.entities[i].s.mluck.f != character.name)
			*/
			&& character.mp > (character.max_mp / 10)
			&& character.mp > G.skills.mluck.mp
			&& distance(character, parent.entities[i]) < G.skills.mluck.range
			&& is_in_range(parent.entities[i], "mluck")
			&& !is_on_cooldown("mluck")) {
			//All eligible players get pushed to the array...
			otherPlayers.push(parent.entities[i]);
		}
	}
	//...and then one random player is picked!
	if (otherPlayers.length > 0 && character.level >= 40) {
		const luckyPlayer = Math.floor(Math.random() * otherPlayers.length)
		use_skill("mluck", otherPlayers[luckyPlayer].name);
		// log(`Giving luck to: ${otherPlayers[luckyPlayer].name}`);
	}
}

// Price Check Loop
cachePriceInfo();
setInterval(function () {
    cachePriceInfo()
}, 60000 * 30);

function cachePriceInfo() {
    if (character.map !== 'main') return;
    let priceDetails = JSON.parse(localStorage.getItem('priceDetails')) || {};
    let merchants = Object.values(parent.entities).filter(mob => is_character(mob) && mob.ctype === "merchant" && mob.stand);
    for (let merchant of merchants) {
        for (let s = 1; s <= 16; s++) {
            let slot = merchant.slots['trade' + s];
            if (slot) {
                let level = '';
                if (slot.level) level = slot.level;
                if (slot.b) {
                    if (!priceDetails[slot.name + level]) {
                        priceDetails[slot.name + level] = {
                            bhigh: slot.price,
                            bavg: slot.price,
                            blow: slot.price,
                            bseen: 1
                        }
                    } else {
                        let details = priceDetails[slot.name + level];
                        let seen = details.bseen + 1;
                        let avg = (details.bavg + slot.price) / 2;
                        let high = details.bhigh;
                        if (high < slot.price) high = slot.price;
                        let low = details.blow;
                        if (low > slot.price) low = slot.price;
                        details.bhigh = high;
                        details.bavg = avg;
                        details.blow = low;
                        details.bseen = seen;
                        priceDetails[slot.name + level] = details;
                    }
                } else {
                    if (!priceDetails[slot.name + level]) {
                        priceDetails[slot.name + level] = {
                            shigh: slot.price,
                            savg: slot.price,
                            slow: slot.price,
                            sseen: 1
                        }
                    } else {
                        let details = priceDetails[slot.name + level];
                        let seen = details.sseen + 1;
                        let avg = (details.savg + slot.price) / 2;
                        let high = details.shigh;
                        if (high < slot.price) high = slot.price;
                        let low = details.slow;
                        if (low > slot.price) low = slot.price;
                        details.shigh = high;
                        details.savg = avg;
                        details.slow = low;
                        details.sseen = seen;
                        priceDetails[slot.name + level] = details;
                    }
                }
            }
        }
    }
    localStorage.removeItem('priceDetails');
    localStorage.setItem('priceDetails', JSON.stringify(priceDetails));
}

// Update your data
setInterval(function () {
    updateCharacterData();
}, 5000);

let realms = [{ region: 'EU', name: 'I' }, { region: 'EU', name: 'II' }, { region: 'EU', name: 'PVP' },
{ region: 'US', name: 'I' }, { region: 'US', name: 'II' }, { region: 'US', name: 'III' }, { region: 'US', name: 'PVP' }];
let currentRealm = parseInt(localStorage.getItem('realmSwapCount')) || 0;

//Realm switching
function realmRotation() {
    if (currentRealm > realms.length - 1) currentRealm = 0;
    let destination = realms[currentRealm];
    currentRealm++;
    localStorage.setItem('realmSwapCount', JSON.stringify(currentRealm));
    change_server(destination.region, destination.name);
}