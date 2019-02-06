game_log("---Mage Script Start---");
load_code(2);
let combat;
let state = "farm";

//Movement And Attacking
setInterval(function () {
    if (character.party && (state === 'farm' || combat)) {
        farm();
    } else if (state === 'resupply_potions') resupply_potions();
}, 100);//Execute 10 times per second

//Potions and state
setInterval(function () {
    state_controller();
    if (can_use('use_hp') && character.hp < character.max_hp * 0.25) {
        use('use_hp');
    } else if (can_use('use_mp') && character.mp < character.max_mp * 0.75) {
        use('use_mp');
    } else if (can_use('use_hp') && character.hp < character.max_hp * 0.45) {
        use('use_hp');
    }
    // Check for BIS
    equip_best_available();
}, 500);//Execute 2 times per second

function state_controller() {
    //If dead respawn
    if (character.rip) return respawn();
    //Default to farming
    let new_state = "farm";
    //Do we need potions?
    new_state = potion_check(new_state)
    //If state changed set it and announce
    if (state !== new_state) {
        game_log("---NEW STATE " + new_state + "---");
        state = new_state;
    }
}

function farm() {
    // Mark in combat if anyone in the party is being targeted
    if (character.party) combat = check_for_party_aggro();
    // If you need to blink to leader do it
    if (can_use('blink') && blink_to_leader()) return;
    let target = find_leader_target() || check_for_party_aggro();
    let teleport_target = get_teleport_target();
    // Handle kiting
    let kiteLocation;
    let aggressiveMonsters = nearbyAggressors();
    if (target && distanceToEntity(target) <= character.range * 0.4) kiteLocation = getKitePosition(target, aggressiveMonsters);
    if (target && aggressiveMonsters.length && distanceToEntity(aggressiveMonsters[0]) < 65) kiteLocation = getKitePosition(target, aggressiveMonsters);
    if (teleport_target && can_use('magiport')) {
        if (character.mp < 900) use('use_mp'); else use('magiport', teleport_target);
    } else if (target) {
        let range = distanceToPoint(target.real_x, target.real_y);
        // Energize the party
        if (can_use('energize')) randomEnergize();
        if (range <= character.range && check_tank_aggro()) {
            // Use burst when high mana
            if (character.mp >= character.max_mp * 0.8 && can_use('burst', target)) {
                if (can_use('cburst', target)) use('cburst', target); else use('burst', target);
            }
            // Kite if needed
            if (kiteLocation) moveToPosition(kiteLocation);
            // Attack
            if (can_attack(target))  attack(target);
        } else {
            // If you need to kite do so, otherwise get in range
            if (kiteLocation) moveToPosition(kiteLocation); else moveToTarget(target, character.range * 0.5, character.range * 0.99);
        }
    } else {
        moveToLeader(character.range * 0.5, character.range * 0.7);
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
                if (member !== character.name) whisper_party('Energizing ' + member + ' with increased MP regen and Attack Speed.'); else whisper_party('Energizing myself.');
                use('energize', entity);
            }
        }
    }
}