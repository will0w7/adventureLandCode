game_log("---Mage Script Start---");
load_code(2);
let combat, state, kiting;

//State Controller
setInterval(function () {
    state = stateController(state);
}, 5000);

//Primary Loop
setInterval(function () {
    if (!state) return;
    if (checkPartyAggro() || !stateTasks(state, checkPartyAggro())) farm();
}, 500);

//Fast Loop
setInterval(function () {
    // Update your data
    updateCharacterData();
}, 75);

function farm() {
    loot();
    potionController();
    let leader = get_player(character.party);
    // Fleet if tank is gone
    if (!leader) return moveToLeader(character.range * 0.5, character.range * 0.7);
    // Mark in combat if anyone in the party is being targeted
    if (character.party) combat = checkPartyAggro();
    // If you need to blink to leader do it
    if (can_use('blink') && blink_to_leader()) return;
    let target = getMonstersTargeting(leader)[0] || findLeaderTarget() || checkPartyAggro()
    let teleport_target = get_teleport_target();
    if (teleport_target && can_use('magiport')) {
        if (character.mp < 900) use('use_mp'); else use('magiport', teleport_target);
    } else if (target) {
        // Energize the party
        if (can_use('energize')) randomEnergize();
        if (can_attack(target) && (checkTankAggro() || canOneShot(target))) {
            // Use burst when high mana
            if (character.mp >= character.max_mp * 0.5 && can_use('burst', target)) {
                if (can_use('cburst', target)) use('cburst', target); else use('burst', target);
            }
            // Attack
            attack(target);
            kite(target);
            moveToTarget(target, character.range * 0.5, character.range * 0.99);
        } else {
            // If you need to kite do so, otherwise get in range
            moveToTarget(target, character.range * 0.5, character.range * 0.99);
        }
    } else {
        moveToLeader();
    }
}

function blink_to_leader() {
    if (parent.party_list.length > 0 && character.max_mp > 1600) {
        let leader = get_player(character.party);
        if (!leader || !distanceToPoint(target.real_x, target.real_y) || distanceToPoint(target.real_x, target.real_y) > 1000) {
            if (character.mp < 1600) {
                use('use_mp');
            } else {
                use('blink', parent.party[character.party].x, parent.party[character.party].y);
            }
            return true;
        }
    }
}

function get_teleport_target() {
    if (parent.party_list.length > 0) {
        for (let key in parent.party_list) {
            let member = parent.party_list[key];
            let entity = parent.entities[member];
            if (member === character.name) continue;
            // Don't teleport the tank unless you're in combat
            if (member === character.party && !combat) continue;
            // Don't teleport the merchant
            if (merchant === member || member === character.name) continue;
            if ((entity && entity.ctype === 'merchant') || member.includes('merch')) {
                merchant = member;
                continue;
            }
            if ((entity && entity.rip) || member.rip) continue;
            if (!entity || distanceToPoint(entity.real_x, entity.real_y) >= 1000) return member;
        }
    }
}

function randomEnergize() {
    if (parent.party_list.length > 0) {
        for (let key in shuffle(parent.party_list)) {
            let member = parent.party_list[key];
            let entity = parent.entities[member];
            // Don't energize far away, high mp, has energize or merchants
            if (!entity || entity.ctype === 'merchant' || entity.mp > entity.max_mp * 0.11 || checkEntityForBuff(entity, 'energized')) continue;
            if (Math.random() > 0.7) {
                if (member !== character.name) whisperParty('Energizing ' + member + ' with increased MP regen and Attack Speed.'); else whisperParty('Energizing myself.');
                use('energize', entity);
            }
        }
    }
}