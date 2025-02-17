//BANKING
//Drop off gold
function depositGold(amount = character.gold - 5000) {
    if (character.map !== 'bank') {
        shibMove('bank');
        return false;
    } else {
        bank_deposit(amount);
        bankTracking();
        return true;
    }
}

//Pick Up Gold
function withdrawGold(amount) {
    if (character.map !== 'bank') {
        shibMove('bank');
        return false;
    } else {
        if (amount > character.id['gold']) amount = character.id['gold'];
        bank_withdraw(amount);
        bankTracking();
    }
}

//Drop off all items
function depositItems(potions = false) {
    if (character.map !== 'bank') {
        shibMove('bank');
        return false;
    } else {
        for (let key in character.items) {
            let item = character.items[key];
            if (!item || item === null) continue;
            let itemInfo = G.items[item.name];
            if (classInventory[character.ctype].includes(item.name)) continue;
            if (!potions && (itemInfo.id === 'hpot1' || itemInfo.id === 'mpot1')) continue;
            if (itemInfo.type === 'stand') continue;
            bank_store(key);
        }
        bankTracking();
        return true;
    }
}

//Drop off all items
function depositItem(slot) {
    if (character.map !== 'bank') {
        shibMove('bank');
        return false;
    } else {
        bank_store(slot);
        bankTracking();
        return true;
    }
}

//Withdraw Item
function withdrawItem(target, level = undefined) {
    if (character.map !== 'bank') {
        shibMove('bank');
        return false;
    } else {
        let details = getItemBankSlot(target, level);
        if (details) {
            bankItemWithdraw(details.slot, details.pack);
            return true;
        } else if (details === null) {
            return null;
        }
    }
}

// Get item pack/slot
function getItemBankSlot(target, level = undefined) {
    if (character.map !== 'bank') {
        shibMove('bank');
        return false;
    } else {
        for (let key in Object.values(character.id)) {
            let slot = Object.values(character.id)[key];
            if (!slot || !slot.length) continue;
            for (let packKey in slot) {
                let item = slot[packKey];
                if (!item || item === null || item.name !== target) continue;
                let iLevel = item_properties(item).level;
                if (level === undefined || iLevel === parseInt(level)) {
                    return {pack: Object.keys(character.id)[key], slot: packKey};
                }
            }
        }
        return null;
    }
}

// No function for withdrawing
function bankItemWithdraw(key, pack) {
    character.bank[pack][key] = undefined;
    parent.socket.emit("bank",{operation:"swap",str:key,inv:-1,pack:pack});
    bankTracking();
}

//Get the highest level of a certain item in the bank
function getHighestLevel(itemName) {
    let best, bestLevel;
    for (let key in Object.values(character.id)) {
        let bankTab = Object.values(character.id)[key];
        if (!bankTab || !bankTab.length) continue;
        for (let itemKey in bankTab) {
            let item = bankTab[itemKey];
            if (!item || item.name !== itemName || !G.items[itemName]) continue;
            if (!best || item_properties(item).level > bestLevel) {
                best = item;
                bestLevel = item_properties(item).level;
            }
        }
    }
    return best;
}

// Get total number of an object regardless of level
function totalInBank(name) {
    let bankDetails = JSON.parse(localStorage.getItem('bankDetails'));
    let count = 0;
    for (let l = 0; l < 12; l++) {
        if (bankDetails[name + l]) count += bankDetails[name + l];
    }
    return count;
}

//Get bank information
function bankTracking() {
    if (character.map !== 'bank') return;
    let bankDetails = {};
    if (typeof character.id === 'undefined') return;
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
    localStorage.removeItem('bankDetails');
    localStorage.setItem('bankDetails', JSON.stringify(bankDetails));
}