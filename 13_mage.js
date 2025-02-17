game_log("---Mage Script Start---");
if (get_active_characters()[character.name] === 'self') load_code(2);
let combat;
let state;

//State Controller
setInterval(function () {
    if (character.rip && state !== 99) state = 99;
    if (combat) state = 1; else state = stateController(state);
}, 5000);

//Combat Loop
setInterval(function () {
    if (!state || state !== 1) return;
    farm();
}, 100);

//Other Task Loop
setInterval(function () {
    let magiPortTarget = getMagiPortTarget();
    if (magiPortTarget && can_use('magiport')) {
        if (character.mp < 900) use('use_mp'); else use('magiport', magiPortTarget);
    } else
    // Energize the party
    if (can_use('energize')) energizeNeedy(); else if (can_use('blink') && blinkToLeader()) return;
    loot();
    potionController();
    if (!state) return;
    stateTasks(state);
}, 3000);

// Update your data
setInterval(function () {
    updateCharacterData();
}, 5000);

function farm() {
    // Mark in combat if anyone in the party is being targeted
    if (character.party) combat = checkPartyAggro(); else return kite();
    let leader = get_player(character.party);
    // Fleet if tank is gone
    if (!leader) return moveToLeader(character.range * 0.5, character.range * 0.7);
    let target = getEntitiesTargeting(leader, true)[0] || findLeaderTarget() || checkPartyAggro() || getEntitiesTargeting()[0];
    if (target) {
        if (can_attack(target) && (checkIfSafeToAggro(target) || canOneShot(target))) {
            // Use burst when high mana
            if (character.mp >= character.max_mp * 0.5 && can_use('burst', target)) {
                if (can_use('cburst', target)) use('cburst', target); else use('burst', target);
            }
            // Attack
            attack(target);
        }
        if (!kite()) moveToTarget(target, character.range * 0.5, character.range * 0.7);
    } else {
        if (!kite()) moveToLeader(character.range * 0.1, character.range * 0.15);
    }
}

function blinkToLeader() {
    if (parent.party_list.length > 0 && character.max_mp > 1600) {
        let leader = get_player(character.party);
        if (!leader) {
            if (character.mp < 1600) {
                use('use_mp');
            } else {
                use('blink', parent.party[character.party].x, parent.party[character.party].y);
            }
            return true;
        }
    }
}

function getMagiPortTarget() {
    if (parent.party_list.length > 0) {
        let leader = get_player(character.party);
        // Don't teleport unless you're with the party;
        if (!leader || parent.distance(character, leader) > 250) return;
        for (let key in parent.party_list) {
            let member = parent.party_list[key];
            let memberData = getCharacterData()[member];
            let entity = parent.entities[member];
            // Skip yourself
            if (member === character.name) continue;
            // If we have member data and they're not in farm mode skip
            if (memberData && memberData.state !== 1) continue;
            // If we don't have member data skip
            if (!memberData) continue;
            // Don't teleport the tank unless you're in combat
            if (member === character.party && !combat) continue;
            // Don't teleport the merchant
            if (parent.party[member].type === 'merchant') continue;
            // Don't teleport the dead
            if ((entity && entity.rip) || member.rip) continue;
            if (!entity || distanceToPoint(entity.real_x, entity.real_y) >= 1000) return member;
        }
    }
}

function energizeNeedy() {
    if (parent.party_list.length > 0) {
        for (let key of parent.party_list) {
            let entity = parent.entities[key];
            // Don't energize far away, high mp, has energize or merchants
            if (!entity || entity.ctype === 'merchant' || entity.mp > entity.max_mp * 0.11 || checkEntityForBuff(entity, 'energized') || key === character.name) continue;
            parent.socket.emit("skill", {
                name: "energize",
                id: entity.id,
                mp: character.mp / 2
            });
            return whisperParty("ENERGIZING: Sending some MP over to " + key);
        }
    }
}