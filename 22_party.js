// Handle waiting for a healer
let healerNotify;
function waitForHealer(range = 300, silent = false) {
    let healerFound = false;
    if (character.map === 'bank') return false;
    if (parent.party_list.length > 0) {
        for (let character of parent.party_list) {
            let entity = parent.entities[character];
            if (!entity || entity.ctype !== 'priest') continue;
            healerFound = true;
            if (entity && entity.mp < entity.max_mp * 0.03) {// Priest is low MP
                if (!healerNotify) {
                    game_log('Healer is OOM.');
                }
                healerNotify = true;
                return true;
            }
            // Handle distance
            if (distanceToPoint(entity.real_x, entity.real_y) >= entity.range * 1.5) {
                if (!healerNotify) {
                    game_log('Healer Range.');
                    if (!silent) whisperParty('Waiting on a healer.');
                }
                healerNotify = true;
                return true;
            }
        }
    }
    if (!healerFound) {
        if (!healerNotify) {
            game_log('No healer??');
        }
        healerNotify = true;
        return true;
    }
    healerNotify = undefined;
}

// Whisper the party
let messageQueue = [];
let lastSent;
function whisperParty(message, sendPublic = false) {
    if (lastSent && lastSent + 1100 > Date.now()) {
        messageQueue.push(message);
        return;
    }
    if (parent.party_list.length > 0) {
        lastSent = Date.now();
        say('/p ' + message);
    } else if (sendPublic) {
        lastSent = Date.now();
        say(message);
    }
}
// Queued message loop
setInterval(function () {
    if (messageQueue.length && lastSent + 1200 <= Date.now()) {
        if (parent.party_list.length > 0) {
            lastSent = Date.now();
            say('/p ' + messageQueue[0]);
            messageQueue.shift();
        }
    }
}, 500);

let partyTracker = {};
// Restarts lost party members
function refreshCharacters(pvp, force = false) {
    // If we're missing people refresh
    if (force) {
        stop();
        whisperParty('Going to refresh the party, one second...');
        //Stops all
        for (let char of pveCharacters) {
            if (char.name === character.name) continue;
            stop_character(char.name);
        }
        if (!pvp) {
            //Healer
            let healer = shuffle(pveCharacters.filter((c) => c.role === 'healer'))[0];
            if (!Object.keys(get_active_characters()).includes(healer.name)) start_character(healer.name, healer.slot); else load_code(healer.slot);
            //DPS
            let dps = shuffle(pveCharacters.filter((c) => c.role === 'dps'))[0];
            if (!Object.keys(get_active_characters()).includes(dps.name)) start_character(dps.name, dps.slot); else load_code(dps.slot);
            //Tank
            let tank = shuffle(pveCharacters.filter((c) => c.role === 'tank'))[0];
            if (!Object.keys(get_active_characters()).includes(tank.name)) start_character(tank.name, tank.slot); else load_code(tank.slot);
            //Merchant
            let merchant = shuffle(pveCharacters.filter((c) => c.role === 'merchant'))[0];
            if (!Object.keys(get_active_characters()).includes(merchant.name)) start_character(merchant.name, merchant.slot); else load_code(merchant.slot);
        } else {
            let rogues = pveCharacters.filter((c) => c.class === 'rogue');
            for (let rogue of rogues) {
                if (!Object.keys(get_active_characters()).includes(rogue.name)) start_character(rogue.name, rogue.slot); else load_code(rogue.slot);
            }
        }
    } else {
        // Handle cases where party members go AWOL
        if (parent.party_list.length > 0) {
            for (let member of parent.party_list) {
                let acceptedStates = ["starting","loading","code"];
                if (!acceptedStates.includes(get_active_characters()[member])) continue;
                if (!partyTracker[member]) {
                    partyTracker[member] = Date.now();
                } else {
                    let coolDown = ((1000 * 60) * 5);
                    if (parent.party[member].type === 'merchant') coolDown = ((1000 * 60) * 30);
                    if (partyTracker[member] + coolDown < Date.now()) {
                        let loginData = pveCharacters.filter((c) => c.name === member);
                        start_character(member, loginData.slot);
                        partyTracker[member] = Date.now();
                        game_log('Rebooting ' + member + ' as he has not been seen in over ' + (coolDown / 1000) / 60 + ' minutes.');
                    } else {
                        // If you can find the entity you can "see" him
                        if (parent.entities[member]) partyTracker[member] = Date.now();
                    }
                }
            }
        }
    }
}

// Find a healer via party data
function findStoredHealer() {
    let currentData = JSON.parse(localStorage.getItem('myDetails'));
    if (currentData) {
        for (let key of Object.keys(currentData)) {
            let member = currentData[key];
            if (member.ctype === 'priest') {
                return member;
            }
        }
    }
}

// Store my character data
function updateCharacterData() {
    // Get or create data
    let currentData = JSON.parse(localStorage.getItem('myDetails')) || {};
    // Store data
    let combat = getEntitiesTargeting().length > 0;
    currentData[character.name] = {
        name: character.name,
        ctype: character.ctype,
        slots: character.slots,
        items: character.items,
        hp: character.hp,
        maxHp: character.max_hp,
        mp: character.mp,
        maxMp: character.max_mp,
        attack: character.attack,
        frequency: character.frequency,
        rpiercing: character.rpiercing,
        apiercing: character.apiercing,
        resistance: character.resistance,
        armor: character.armor,
        xp: character.xp,
        maxXp: character.max_xp,
        map: character.map,
        x: character.real_x,
        y: character.real_y,
        target: character.target,
        combat: combat
    };
    localStorage.setItem('myDetails', JSON.stringify(currentData));
}

// Recall my character data
function getCharacterData() {
    let currentData = {};
    if (localStorage.getItem('myDetails')) currentData = JSON.parse(localStorage.getItem('myDetails'));
    return currentData;
}