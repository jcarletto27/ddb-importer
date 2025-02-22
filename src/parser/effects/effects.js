import utils from "../../utils.js";
import logger from "../../logger.js";
import DICTIONARY from "../../dictionary.js";
import {
  getWeaponProficiencies,
  getArmorProficiencies,
  getToolProficiencies,
  getLanguagesFromModifiers,
} from "../character/proficiencies.js";
import { getSkillProficiency } from "../character/skills.js";
import { equipmentEffectAdjustment } from "./specialEquipment.js";
import { spellEffectAdjustment } from "./specialSpells.js";
import { featureEffectAdjustment } from "./specialFeats.js";

/**
 * Add supported effects here to exclude them from calculations.
 */
const EFFECT_EXCLUDED_COMMON_MODIFIERS = [
  { type: "bonus", subType: "saving-throws" },
  { type: "bonus", subType: "ability-checks" },
  { type: "bonus", subType: "skill-checks" },
  { type: "bonus", subType: "proficiency-bonus" },

  { type: "set", subType: "strength-score" },
  { type: "set", subType: "dexterity-score" },
  { type: "set", subType: "constitution-score" },
  { type: "set", subType: "wisdom-score" },
  { type: "set", subType: "intelligence-score" },
  { type: "set", subType: "charisma-score" },

  // skills
  { type: "bonus", subType: "acrobatics" },
  { type: "bonus", subType: "animal-handling" },
  { type: "bonus", subType: "arcana" },
  { type: "bonus", subType: "athletics" },
  { type: "bonus", subType: "deception" },
  { type: "bonus", subType: "history" },
  { type: "bonus", subType: "insight" },
  { type: "bonus", subType: "intimidation" },
  { type: "bonus", subType: "investigation" },
  { type: "bonus", subType: "medicine" },
  { type: "bonus", subType: "nature" },
  { type: "bonus", subType: "perception" },
  { type: "bonus", subType: "performance" },
  { type: "bonus", subType: "persuasion" },
  { type: "bonus", subType: "religion" },
  { type: "bonus", subType: "sleight-of-hand" },
  { type: "bonus", subType: "stealth" },
  { type: "bonus", subType: "survival" },
  // advantage on skills - not added here as not used elsewhere in importer.
  // { type: "advantage", subType: "acrobatics" },

  // initiative
  { type: "advantage", subType: "initiative" },

  // saving throws and ability checks - with midi
  // not adding these as they are not used elsewhere
  // { type: "advantage", subType: "strength-saving-throws" },
];

const EFFECT_EXCLUDED_SPELL_MODIFIERS = [
  { type: "bonus", subType: "spell-save-dc" },
  { type: "bonus", subType: "spell-attacks" },
  { type: "bonus", subType: "warlock-spell-save-dc" },
  { type: "bonus", subType: "warlock-spell-attacks" },
  { type: "bonus", subType: "spell-group-healing" } // data.bonuses.heal.damage
];

const EFFECT_EXCLUDED_HP_MODIFIERS = [
  { type: "bonus", subType: "hit-points-per-level" },
  { type: "bonus", subType: "hit-points" },
];

const EFFECT_EXCLUDED_SENSE_MODIFIERS = [
  // senses
  { type: "set-base", subType: "darkvision" },
  { type: "sense", subType: "darkvision" },
  { type: "set-base", subType: "blindsight" },
  { type: "sense", subType: "blindsight" },
  { type: "set-base", subType: "tremorsense" },
  { type: "sense", subType: "tremorsense" },
  { type: "set-base", subType: "truesight" },
  { type: "sense", subType: "truesight" },
];

const EFFECT_EXCLUDED_SPEED_MODIFIERS = [
  // speeds
  { type: "set", subType: "innate-speed-walking" },
  { type: "set", subType: "innate-speed-climbing" },
  { type: "set", subType: "innate-speed-swimming" },
  { type: "set", subType: "innate-speed-flying" },

  { type: "bonus", subType: "speed" },
  { type: "bonus", subType: "unarmored-movement" },
  { type: "bonus", subType: "speed-walking" },
  { type: "bonus", subType: "speed-climbing" },
  { type: "bonus", subType: "speed-swimming" },
  { type: "bonus", subType: "speed-flying" },
];

const EFFECT_EXCLUDED_ABILITY_BONUSES = [
  { type: "bonus", subType: "strength-score" },
  { type: "bonus", subType: "dexterity-score" },
  { type: "bonus", subType: "constitution-score" },
  { type: "bonus", subType: "wisdom-score" },
  { type: "bonus", subType: "intelligence-score" },
  { type: "bonus", subType: "charisma-score" },
];

const EFFECT_EXCLUDED_PROFICIENCY_BONUSES = [
  // profs
  { type: "proficiency", subType: null },
];

const EFFECT_EXCLUDED_LANGUAGES_MODIFIERS = [
  // languages - e.g. dwarvish -- lookup from DICTIONARY
  { type: "language", subType: null },
];

const EFFECT_EXCLUDED_DAMAGE_CONDITION_MODIFIERS = [
  // resistances - subType - e.g. poison - lookup from DICTIONARY
  { type: "resistance", subType: null },
  { type: "immunity", subType: null },
  { type: "vulnerability", subType: null },
];

const AC_EFFECTS = [
  { type: "set", subType: "unarmored-armor-class" },
  { type: "bonus", subType: "unarmored-armor-class" },
  { type: "bonus", subType: "armor-class" },
  { type: "bonus", subType: "armored-armor-class" },
  { type: "bonus", subType: "dual-wield-armor-class" },
  { type: "ignore", subType: "unarmored-dex-ac-bonus" },
  { type: "set", subType: "ac-max-dex-modifier" },
];

export function getEffectExcludedModifiers(type) {
  let modifiers = EFFECT_EXCLUDED_COMMON_MODIFIERS;
  if (["feat", "background"].includes(type)) {
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-ability-bonus`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_ABILITY_BONUSES);
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-proficiencies`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_PROFICIENCY_BONUSES);
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-languages`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_LANGUAGES_MODIFIERS);
  }
  if (["feat", "background", "race", "class"].includes(type)) {
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-speed`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_SPEED_MODIFIERS);
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-senses`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_SENSE_MODIFIERS);
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-hp`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_HP_MODIFIERS);
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-spell-bonus`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_SPELL_MODIFIERS);
    if (game.settings.get("ddb-importer", `character-update-policy-effect-${type}-damages`)) modifiers = modifiers.concat(EFFECT_EXCLUDED_DAMAGE_CONDITION_MODIFIERS);
    if (game.settings.get("ddb-importer", "character-update-policy-generate-ac-feature-effects")) modifiers = modifiers.concat(AC_EFFECTS);
  }
  if (type === "item") {
    modifiers = modifiers.concat(
      EFFECT_EXCLUDED_ABILITY_BONUSES,
      EFFECT_EXCLUDED_DAMAGE_CONDITION_MODIFIERS,
      EFFECT_EXCLUDED_LANGUAGES_MODIFIERS,
      EFFECT_EXCLUDED_PROFICIENCY_BONUSES,
      EFFECT_EXCLUDED_SPEED_MODIFIERS,
      EFFECT_EXCLUDED_SENSE_MODIFIERS,
      EFFECT_EXCLUDED_HP_MODIFIERS,
      EFFECT_EXCLUDED_SPELL_MODIFIERS
    );
  }
  return modifiers;
}

/**
 *
 * Generate a base effect for an Item
 *
 * @param {*} formula
 * @param {*} mode
 * @param {*} itemData
 * @param {*} label
 * @param {*} origin
 */

export function baseItemEffect(foundryItem, label) {
  return {
    label,
    icon: foundryItem.img,
    changes: [],
    duration: {},
    // duration: {
    //   seconds: null,
    //   startTime: null,
    //   rounds: null,
    //   turns: null,
    //   startRound: null,
    //   startTurn: null,
    // },
    tint: "",
    transfer: true,
    disabled: false,
    // origin: origin,
    flags: {
      dae: {
        transfer: true,
        stackable: false,
        // armorEffect: true
      },
      ddbimporter: {
        disabled: false,
      },
    },
    // _id: `${randomID()}${randomID()}`,
  };
}

// *
// CONST.ACTIVE_EFFECT_MODES.
// ADD: 2
// CUSTOM: 0
// DOWNGRADE: 3
// MULTIPLY: 1
// OVERRIDE: 5
// UPGRADE: 4
//

export function generateBaseSkillEffect(id) {
  const mockItem = {
    img: "icons/svg/up.svg",
  };
  const label = "Misc Skill Bonuses";
  let skillEffect = baseItemEffect(mockItem, label);
  skillEffect.flags.dae = {};
  skillEffect.flags.ddbimporter.characterEffect = true;
  skillEffect.origin = `Actor.${id}`;
  delete skillEffect.transfer;
  return skillEffect;
}

export function generateChange(bonus, priority, key, mode) {
  return {
    key: key,
    value: bonus,
    mode: mode,
    priority: priority,
  };
}

export function generateAddChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.ADD);
}

export function generateCustomChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.CUSTOM);
}

export function generateCustomBonusChange(bonus, priority, key) {
  return generateChange(`+${bonus}`, priority, key, CONST.ACTIVE_EFFECT_MODES.CUSTOM);
}

export function generateUpgradeChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.UPGRADE);
}

export function generateOverrideChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.OVERRIDE);
}

export function generateMultiplyChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.MULTIPLY);
}

export function generateDowngradeChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.DOWNGRADE);
}

//
function extractModifierValue(modifier) {
  let value = "";
  let modBonus = "";

  if (modifier.statId) {
    const ability = DICTIONARY.character.abilities.find((ability) => ability.id === modifier.statId).value;
    modBonus = `+ @abilities.${ability}.mod`;
  } else if (modifier.abilityModifierStatId) {
    const ability = DICTIONARY.character.abilities.find(
      (ability) => ability.id === modifier.abilityModifierStatId.statId
    ).value;
    modBonus = `+ @abilities.${ability}.mod`;
  }

  const fixedBonus = modifier.dice?.fixedValue ? ` + ${modifier.dice.fixedValue}` : "";

  if (modifier.dice) {
    if (modifier.dice.diceString) {
      value = modifier.dice.diceString + modBonus + fixedBonus;
    } else if (fixedBonus) {
      value = fixedBonus + modBonus;
    }
  } else if (modifier.fixedValue) {
    value = modifier.fixedValue;
  } else if (modifier.value) {
    value = modifier.value;
  }

  return value;
}

/**
 * Generates a global custom bonus for an item with a +
 */
function addCustomBonusEffect(modifiers, name, type, key) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", type).reduce((a, b) => a + b.value, 0);
  if (bonus !== 0) {
    logger.debug(`Generating ${type} bonus for ${name}`);
    changes.push(generateCustomBonusChange(bonus, 18, key));
  }
  return changes;
}

/**
 * Generates a global custom bonus for an item
 */
function addCustomEffect(modifiers, name, type, key, extra = "") {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", type).reduce((a, b) => a + b.value, 0);
  if (bonus !== 0) {
    logger.debug(`Generating ${type} bonus for ${name}`);
    changes.push(generateCustomChange(`+ ${bonus}${(extra) ? extra : ""}`, 18, key));
  }
  return changes;
}

/**
 * Generates a global add for an item
 */
function addAddEffect(modifiers, name, type, key) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", type).reduce((a, b) => a + b.value, 0);
  if (bonus !== 0) {
    logger.debug(`Generating ${type} bonus for ${name}`);
    changes.push(generateAddChange(bonus, 18, key));
  }
  return changes;
}

/**
 * Adds languages, can't handle custom languages
 */
function addLanguages(modifiers, name) {
  let changes = [];

  const languages = getLanguagesFromModifiers(null, modifiers);

  languages.value.forEach((prof) => {
    logger.debug(`Generating language ${prof} for ${name}`);
    changes.push(generateCustomChange(prof, 0, "data.traits.languages.value"));
  });
  if (languages?.custom != "") {
    logger.debug(`Generating language ${languages.custom} for ${name}`);
    changes.push(generateCustomChange(languages.custom, 0, "data.traits.languages.custom"));
  }

  return changes;
}

// *
// Get list of generic conditions/damages
//
function getGenericConditionAffect(modifiers, condition, typeId) {
  const damageTypes = DICTIONARY.character.damageTypes
    .filter((type) => type.kind === condition && type.type === typeId)
    .map((type) => type.value);

  let restrictions = [
    "",
    null,
    "While within 20 feet",
    "Dwarf Only",
    "While Not Incapacitated",
    // "As an Action", this is a timed/limited effect, dealt with elsewhere
    "While Staff is Held",
    "Helm has at least one ruby remaining",
    "while holding",
    "While Held",
  ];
  let result = utils
    .filterModifiers(modifiers, condition, null, restrictions)
    .filter((modifier) => modifier.isGranted && damageTypes.includes(modifier.subType))
    .map((modifier) => {
      const entry = DICTIONARY.character.damageTypes.find(
        (type) => type.type === typeId && type.kind === modifier.type && type.value === modifier.subType
      );
      return entry ? entry.foundryValue || entry.value : undefined;
    });

  return result;
}

/**
 * Get  Damage Conditions, and Condition Immunities
 * @param {*} ddbItem
 */
function addDamageConditions(modifiers) {
  let charges = [];

  const damageImmunities = getGenericConditionAffect(modifiers, "immunity", 2);
  const damageResistances = getGenericConditionAffect(modifiers, "resistance", 2);
  const damageVulnerability = getGenericConditionAffect(modifiers, "vulnerability", 2);

  damageImmunities.forEach((type) => {
    charges.push(generateCustomChange(type, 1, "data.traits.di.value"));
  });
  damageResistances.forEach((type) => {
    charges.push(generateCustomChange(type, 1, "data.traits.dr.value"));
  });
  damageVulnerability.forEach((type) => {
    charges.push(generateCustomChange(type, 1, "data.traits.dv.value"));
  });

  const conditionImmunities = getGenericConditionAffect(modifiers, "immunity", 1);

  conditionImmunities.forEach((type) => {
    charges.push(generateCustomChange(type, 1, "data.traits.ci.value"));
  });

  // data.traits.di.all
  const allDamageImmunity = utils.filterModifiers(modifiers, "immunity", "all");
  if (allDamageImmunity?.length > 0) {
    charges.push(generateCustomChange(1, 1, "data.traits.di.all"));
  }

  return charges;
}

// *
// Generate stat bonuses
//
function addStatBonusEffect(modifiers, name, subType) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "bonus" && modifier.subType === subType);

  let effects = [];
  if (bonuses.length > 0) {
    bonuses.forEach((bonus) => {
      const maxMatch = /Maximum of (\d*)/;
      const match = bonus.restriction ? bonus.restriction.match(maxMatch) : false;
      logger.debug(`Generating ${subType} stat bonus for ${name}`);
      const ability = DICTIONARY.character.abilities.find((ability) => ability.long === subType.split("-")[0]);
      const abilityScoreMaxBonus = modifiers
        .filter((modifier) => modifier.type === "bonus" && modifier.subType === "ability-score-maximum")
        .filter((mod) => mod.statId === ability.id)
        .reduce((prev, cur) => prev + cur.value, 0);
      const max = match ? match[1] : 20 + abilityScoreMaxBonus;

      const bonusString = `{${max}, @data.abilities.${ability.value}.value + ${bonus.value}} kl`;
      effects.push(generateOverrideChange(bonusString, 5, `data.abilities.${ability.value}.value`));
    });
  }
  return effects;
}

function addStatBonuses(modifiers, name) {
  let changes = [];
  const stats = [
    "strength-score",
    "dexterity-score",
    "constitution-score",
    "wisdom-score",
    "intelligence-score",
    "charisma-score",
  ];
  stats.forEach((stat) => {
    const result = addStatBonusEffect(modifiers, name, stat);
    changes = changes.concat(result);
  });

  return changes;
}

// *
// Generate stat sets
//
function addStatSetEffect(modifiers, name, subType) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "set" && modifier.subType === subType);

  let effects = [];
  // dwarfen "Maximum of 20"
  if (bonuses.length > 0) {
    bonuses.forEach((bonus) => {
      logger.debug(`Generating ${subType} stat set for ${name}`);
      const ability = DICTIONARY.character.abilities.find((ability) => ability.long === subType.split("-")[0]).value;
      effects.push(generateUpgradeChange(bonus.value, 3, `data.abilities.${ability}.value`));
    });
  }
  return effects;
}

// requires midi
// does not add advantages with restrictions - which is most of them
function addAbilityAdvantageEffect(modifiers, name, subType, type) {
  const bonuses = utils.filterModifiers(modifiers, "advantage", subType);

  let effects = [];
  if (bonuses.length > 0) {
    logger.debug(`Generating ${subType} saving throw advantage for ${name}`);
    const ability = DICTIONARY.character.abilities.find((ability) => ability.long === subType.split("-")[0]).value;
    effects.push(generateCustomChange(1, 4, `flags.midi-qol.advantage.ability.${type}.${ability}`));
  }
  return effects;
}

function addStatChanges(modifiers, name) {
  let changes = [];
  const stats = ["strength", "dexterity", "constitution", "wisdom", "intelligence", "charisma"];
  stats.forEach((stat) => {
    const statEffect = addStatSetEffect(modifiers, name, `${stat}-score`);
    const savingThrowAdvantage = addAbilityAdvantageEffect(modifiers, name, `${stat}-saving-throw`, "save");
    const abilityCheckAdvantage = addAbilityAdvantageEffect(modifiers, name, `${stat}-ability-checks`, "check");
    changes = changes.concat(statEffect, savingThrowAdvantage, abilityCheckAdvantage);
  });

  return changes;
}

// *
// Senses
//
function addSenseBonus(modifiers, name) {
  let changes = [];

  const senses = ["darkvision", "blindsight", "tremorsense", "truesight"];

  senses.forEach((sense) => {
    const base = modifiers
      .filter((modifier) => modifier.type === "set-base" && modifier.subType === sense)
      .map((mod) => mod.value);
    if (base.length > 0) {
      logger.debug(`Generating ${sense} base for ${name}`);
      changes.push(generateUpgradeChange(Math.max(base), 10, `data.attributes.senses.${sense}`));
    }
    const bonus = modifiers
      .filter((modifier) => modifier.type === "sense" && modifier.subType === sense)
      .reduce((a, b) => a + b.value, 0);
    if (bonus > 0) {
      logger.debug(`Generating ${sense} bonus for ${name}`);
      changes.push(generateAddChange(Math.max(bonus), 15, `data.attributes.senses.${sense}`));
    }
  });
  return changes;
}

/**
 * Proficiency bonus
 */

function addProficiencyBonus(modifiers, name) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", "proficiency-bonus").reduce((a, b) => a + b.value, 0);
  if (bonus) {
    logger.debug(`Generating proficiency bonus for ${name}`);
    changes.push(generateCustomChange(bonus, 0, "data.attributes.prof"));
  }
  return changes;
}

// *
// Generate set speeds
//
function addSetSpeedEffect(modifiers, name, subType) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "set" && modifier.subType === subType);

  let effects = [];
  // "Equal to Walking Speed"
  if (bonuses.length > 0) {
    bonuses.forEach((bonus) => {
      logger.debug(`Generating ${subType} speed set for ${name}`);
      const innate = subType.split("-").slice(-1)[0];
      const speedType = DICTIONARY.character.speeds.find((s) => s.innate === innate).type;
      // current assumption if no speed provided, set to walking speed
      const speed = bonus.value ? bonus.value : "@attributes.movement.walk";
      effects.push(generateUpgradeChange(speed, 5, `data.attributes.movement.${speedType}`));
    });
  }
  return effects;
}

/**
 * Innate Speeds
 */
function addSetSpeeds(modifiers, name) {
  let changes = [];
  const speedSets = [
    "innate-speed-walking",
    "innate-speed-climbing",
    "innate-speed-swimming",
    "innate-speed-flying",
    "innate-speed-burrowing",
  ];
  speedSets.forEach((speedSet) => {
    const result = addSetSpeedEffect(modifiers, name, speedSet);
    changes = changes.concat(result);
  });

  return changes;
}

// *
// Generate speed bonus speeds
//
function addBonusSpeedEffect(modifiers, name, subType, speedType = null) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "bonus" && modifier.subType === subType);

  let effects = [];
  // "Equal to Walking Speed"
  if (bonuses.length > 0) {
    logger.debug(`Generating ${subType} speed bonus for ${name}`);
    if (!speedType) {
      const innate = subType.split("-").slice(-1)[0];
      speedType = DICTIONARY.character.speeds.find((s) => s.innate === innate).type;
    }
    const bonusValue = bonuses.reduce((speed, mod) => speed + mod.value, 0);
    if (speedType === "all") {
      effects.push(generateCustomChange(`+ ${bonusValue}`, 9, `data.attributes.movement.${speedType}`));
    } else {
      effects.push(generateAddChange(bonusValue, 9, `data.attributes.movement.${speedType}`));
    }
  }
  return effects;
}

/**
 * Bonus Speeds
 */
function addBonusSpeeds(modifiers, name) {
  let changes = [];
  const speedBonuses = ["speed-walking", "speed-climbing", "speed-swimming", "speed-flying", "speed-burrowing"];
  speedBonuses.forEach((speed) => {
    const result = addBonusSpeedEffect(modifiers, name, speed);
    changes = changes.concat(result);
  });

  changes = changes.concat(addBonusSpeedEffect(modifiers, name, "unarmored-movement", "walk"));
  changes = changes.concat(addBonusSpeedEffect(modifiers, name, "speed", "walk")); // probably all, but doesn't handle cases of where no base speed set, so say fly gets set to 10.

  return changes;
}

function addSkillProficiencies(modifiers) {
  let changes = [];
  DICTIONARY.character.skills.forEach((skill) => {
    const prof = getSkillProficiency(null, skill, modifiers);
    if (prof != 0) {
      changes.push(generateUpgradeChange(prof, 9, `data.skills.${skill.name}.value`));
    }
  });
  return changes;
}

function addProficiencies(modifiers, name) {
  let changes = [];

  const proficiencies = modifiers
    .filter((mod) => mod.type === "proficiency")
    .map((mod) => {
      return { name: mod.friendlySubtypeName };
    });

  changes = changes.concat(addSkillProficiencies(modifiers));
  const toolProf = getToolProficiencies(null, proficiencies);
  const weaponProf = getWeaponProficiencies(null, proficiencies);
  const armorProf = getArmorProficiencies(null, proficiencies);

  toolProf.value.forEach((prof) => {
    logger.debug(`Generating tool proficiencies for ${name}`);
    changes.push(generateCustomChange(prof, 8, "data.traits.toolProf.value"));
  });
  weaponProf.value.forEach((prof) => {
    logger.debug(`Generating weapon proficiencies for ${name}`);
    changes.push(generateCustomChange(prof, 8, "data.traits.weaponProf.value"));
  });
  armorProf.value.forEach((prof) => {
    logger.debug(`Generating armor proficiencies for ${name}`);
    changes.push(generateCustomChange(prof, 8, "data.traits.armorProf.value"));
  });
  if (toolProf?.custom != "") changes.push(generateCustomChange(toolProf.custom, 8, "data.traits.toolProf.custom"));
  if (weaponProf?.custom != "")
    changes.push(generateCustomChange(weaponProf.custom, 8, "data.traits.weaponProf.custom"));
  if (armorProf?.custom != "") changes.push(generateCustomChange(armorProf.custom, 8, "data.traits.armorProf.custom"));

  return changes;
}

/**
 * Add HP effects
 * @param {*} modifiers
 * @param {*} name
 */
function addHPEffect(modifiers, name, consumable) {
  let changes = [];

  // HP per level
  const hpPerLevel = utils.filterModifiers(modifiers, "bonus", "hit-points-per-level").reduce((a, b) => a + b.value, 0);
  if (hpPerLevel && hpPerLevel > 0) {
    logger.debug(`Generating HP Per Level effects for ${name}`);
    changes.push(generateAddChange(`${hpPerLevel} * @details.level`, 14, "data.attributes.hp.max"));
  }

  const hpBonusModifiers = utils.filterModifiers(modifiers, "bonus", "hit-points");
  if (hpBonusModifiers.length > 0 && !consumable) {
    let hpBonus = "";
    hpBonusModifiers.forEach((modifier) => {
      let hpParse = extractModifierValue(modifier);
      if (hpBonus !== "") hpBonus += " + ";
      hpBonus += hpParse;
    });
    changes.push(generateCustomChange(`${hpBonus}`, 14, "data.attributes.hp.max"));
  }

  return changes;
}

//
// Generate skill bonuses
//
function addSkillBonusEffect(modifiers, name, skill) {
  const bonuses = utils.filterModifiers(modifiers, "bonus", skill.subType);

  let effects = [];
  // dwarfen "Maximum of 20"
  if (bonuses.length > 0) {
    logger.debug(`Generating ${skill.subType} skill bonus for ${name}`);
    const value = bonuses.map((skl) => skl.value).reduce((a, b) => a + b, 0) || 0;
    effects.push(generateAddChange(value, 12, `data.skills.${skill.name}.mod`));
  }
  return effects;
}

//
// generate skill advantages
// requires midi
//
function addSkillMidiEffect(modifiers, name, skill, midiEffect = "advantage") {
  const allowedRestrictions = [
    "",
    null,
    "Sound Only",
    "Sight Only",
    "that rely on smell",
    "While the hood is up, checks made to Hide ",
  ];
  const advantage = utils.filterModifiers(modifiers, midiEffect, skill.subType, allowedRestrictions);

  let effects = [];
  if (advantage.length > 0) {
    logger.debug(`Generating ${skill.subType} skill ${midiEffect} for ${name}`);
    effects.push(generateCustomChange(1, 5, `flags.midi-qol.${midiEffect}.skill.${skill.name}`));
  }
  return effects;
}

function addSkillBonuses(modifiers, name) {
  let changes = [];
  DICTIONARY.character.skills.forEach((skill) => {
    const skillBonuses = addSkillBonusEffect(modifiers, name, skill);
    const skillAdvantages = addSkillMidiEffect(modifiers, name, skill, "advantage");
    changes = changes.concat(skillBonuses, skillAdvantages);
  });

  return changes;
}

//
// initiative
//
function addInitiativeBonuses(modifiers, name) {
  let changes = [];
  const advantage = utils.filterModifiers(modifiers, "advantage", "initiative");
  if (advantage.length > 0) {
    logger.debug(`Generating Intiative advantage for ${name}`);
    changes.push(generateCustomChange(1, 20, "flags.dnd5e.initiativeAdv"));
  }
  return changes;
}

//
// attack rolls against you
// midi only
//
function addAttackRollDisadvantage(modifiers, name) {
  let changes = [];
  const disadvantage = utils.filterModifiers(modifiers, "disadvantage", "attack-rolls-against-you", false);
  if (disadvantage.length > 0) {
    logger.debug(`Generating disadvantage for ${name}`);
    changes.push(generateCustomChange(1, 5, "flags.midi-qol.grants.disadvantage.attack.all"));
  }
  return changes;
}

// midi advantages on saving throws against spells and magical effects
function addMagicalAdvantage(modifiers, name) {
  let changes = [];
  const restrictions = [
    "against spells and magical effects",
    "Against Spells and Magical Effects",
    "Against Spells",
    "against spells",
    "Against spells",
    "Against spells and magical effects within 10 ft. (or 30 ft. at level 17+) while holding the Holy Avenger",
  ];
  const advantage = utils.filterModifiers(modifiers, "advantage", "saving-throws", restrictions);
  if (advantage.length > 0) {
    logger.debug(`Generating magical advantage on saving throws for ${name}`);
    changes.push(generateCustomChange("magic-resistant", 5, "data.traits.dr.custom"));
  }
  return changes;
}

function generateEffectDuration(foundryItem) {
  let duration = {
    seconds: null,
    startTime: null,
    rounds: null,
    turns: null,
    startRound: null,
    startTurn: null,
  };
  switch (foundryItem.data.duration.units) {
    case "turn":
      duration.turns = foundryItem.data.duration.value;
      break;
    case "round":
      duration.rounds = foundryItem.data.duration.value;
      break;
    case "hour":
      duration.seconds = foundryItem.data.duration.value * 60 * 60;
      break;
    case "minute":
      duration.rounds = foundryItem.data.duration.value * 10;
      break;
    // no default
  }
  return duration;
}

function consumableEffect(effect, ddbItem, foundryItem) {
  effect.label = `${foundryItem.name} - Consumable Effects`;
  effect.disabled = false;
  effect.transfer = false;
  setProperty(effect, "flags.ddbimporter.disabled", false);
  setProperty(foundryItem, "flags.dae.transfer", false);
  effect.duration = generateEffectDuration(foundryItem);
  if (!foundryItem.data.target?.value) {
    foundryItem.data.target = {
      value: 1,
      width: null,
      units: "",
      type: "creature",
    };
  }
  if (!foundryItem.data.range?.units) {
    foundryItem.data.range = {
      value: null,
      long: null,
      units: "touch",
    };
  }
  if (foundryItem.data.uses) {
    foundryItem.data.uses.autoDestroy = true;
    foundryItem.data.uses.autoUse = true;
  }

  return effect;
}

/**
 * This checks attunement status and similar to determine effect state
 * set disabled flags etc
 * @param {*} foundryItem
 * @param {*} effect
 * @param {*} ddbItem
 * @param {*} isCompendiumItem
 */
function addEffectFlags(foundryItem, effect, ddbItem, isCompendiumItem) {
  // check attunement status etc

  if (
    !ddbItem.definition?.canEquip &&
    !ddbItem.definition?.canAttune &&
    !ddbItem.definition?.isConsumable &&
    DICTIONARY.types.inventory.includes(foundryItem.type)
  ) {
    // if item just gives a thing and not potion/scroll
    effect.disabled = false;
    setProperty(effect, "flags.ddbimporter.disabled", false);
    setProperty(foundryItem, "flags.dae.alwaysActive", true);
  } else if (
    isCompendiumItem ||
    foundryItem.type === "feat" ||
    (ddbItem.isAttuned && ddbItem.equipped) || // if it is attuned and equipped
    (ddbItem.isAttuned && !ddbItem.definition?.canEquip) || // if it is attuned but can't equip
    (!ddbItem.definition?.canAttune && ddbItem.equipped) // can't attune but is equipped
  ) {
    setProperty(foundryItem, "flags.dae.alwaysActive", false);
    setProperty(effect, "flags.ddbimporter.disabled", false);
    effect.disabled = false;
  } else {
    effect.disabled = true;
    setProperty(effect, "flags.ddbimporter.disabled", true);
    setProperty(foundryItem, "flags.dae.alwaysActive", false);
  }

  setProperty(effect, "flags.ddbimporter.itemId", ddbItem.id);
  setProperty(effect, "flags.ddbimporter.itemEntityTypeId", ddbItem.entityTypeId);
  // set dae flag for active equipped
  if (ddbItem.definition?.canEquip || ddbItem.definitio?.canAttune) {
    setProperty(foundryItem, "flags.dae.activeEquipped", true);
  } else {
    setProperty(foundryItem, "flags.dae.activeEquipped", false);
  }

  if (ddbItem.definition?.filterType === "Potion") {
    effect = consumableEffect(effect, ddbItem, foundryItem);
  }

  return [foundryItem, effect];
}

/**
 * Generate supported effects for items
 * @param {*} ddb
 * @param {*} character
 * @param {*} ddbItem
 * @param {*} foundryItem
 */
function generateGenericEffects(ddb, character, ddbItem, foundryItem, isCompendiumItem) {
  if (!foundryItem.effects) foundryItem.effects = [];
  if (!ddbItem.definition?.grantedModifiers || ddbItem.definition.grantedModifiers.length === 0) return foundryItem;
  logger.debug(`Item: ${foundryItem.name}`, ddbItem);
  logger.debug(`Generating supported effects for ${foundryItem.name}`);

  let effect = baseItemEffect(foundryItem, `${foundryItem.name} - Constant Effects`);

  const globalSaveBonus = addCustomBonusEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "saving-throws",
    "data.bonuses.abilities.save"
  );
  const globalAbilityBonus = addCustomBonusEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "ability-checks",
    "data.bonuses.abilities.check"
  );
  const globalSkillBonus = addCustomBonusEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "skill-checks",
    "data.bonuses.abilities.skill"
  );
  const languages = addLanguages(ddbItem.definition.grantedModifiers, foundryItem.name);
  const conditions = addDamageConditions(ddbItem.definition.grantedModifiers, foundryItem.name);
  const statSets = addStatChanges(ddbItem.definition.grantedModifiers, foundryItem.name);
  const statBonuses = addStatBonuses(ddbItem.definition.grantedModifiers, foundryItem.name);
  const senses = addSenseBonus(ddbItem.definition.grantedModifiers, foundryItem.name);
  const proficiencyBonus = addProficiencyBonus(ddbItem.definition.grantedModifiers, foundryItem.name);
  const speedSets = addSetSpeeds(ddbItem.definition.grantedModifiers, foundryItem.name);
  const spellAttackBonus = addCustomEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "spell-attacks",
    "data.bonuses.spell.attack"
  );
  const spellDCBonus = addAddEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "spell-save-dc",
    "data.bonuses.spell.dc"
  );
  const warlockSpellAttackBonus = addCustomEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "warlock-spell-attacks",
    "data.bonuses.spell.attack"
  );
  const warlockSpellDCBonus = addAddEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "warlock-spell-save-dc",
    "data.bonuses.spell.dc"
  );
  const healingSpellBonus = addCustomEffect(
    ddbItem.definition.grantedModifiers,
    foundryItem.name,
    "spell-group-healing",
    "data.bonuses.heal.damage",
    " + @item.level"
  );

  const profs = addProficiencies(ddbItem.definition.grantedModifiers, foundryItem.name);
  const hp = addHPEffect(ddbItem.definition.grantedModifiers, foundryItem.name, ddbItem.definition.isConsumable);
  const skillBonus = addSkillBonuses(ddbItem.definition.grantedModifiers, foundryItem.name);
  const initiative = addInitiativeBonuses(ddbItem.definition.grantedModifiers, foundryItem.name);
  const disadvantageAgainst = addAttackRollDisadvantage(ddbItem.definition.grantedModifiers, foundryItem.name);
  const magicalAdvantage = addMagicalAdvantage(ddbItem.definition.grantedModifiers, foundryItem.name);
  const bonusSpeeds = addBonusSpeeds(ddbItem.definition.grantedModifiers, foundryItem.name);

  effect.changes = [
    ...globalSaveBonus,
    ...globalAbilityBonus,
    ...globalSkillBonus,
    ...languages,
    ...conditions,
    ...statSets,
    ...statBonuses,
    ...senses,
    ...proficiencyBonus,
    ...speedSets,
    ...spellAttackBonus,
    ...warlockSpellAttackBonus,
    ...spellDCBonus,
    ...warlockSpellDCBonus,
    ...profs,
    ...hp,
    ...skillBonus,
    ...initiative,
    ...disadvantageAgainst,
    ...magicalAdvantage,
    ...bonusSpeeds,
    ...healingSpellBonus,
  ];

  // if we don't have effects, lets return the item
  if (effect.changes?.length === 0) {
    return foundryItem;
  }

  // generate flags for effect (e.g. checking attunement and equiped status)
  [foundryItem, effect] = addEffectFlags(foundryItem, effect, ddbItem, isCompendiumItem);

  if (effect.changes?.length > 0) {
    foundryItem.effects.push(effect);
  }

  return foundryItem;
}

export function generateItemEffects(ddb, character, ddbItem, foundryItem, isCompendiumItem) {
  foundryItem = generateGenericEffects(ddb, character, ddbItem, foundryItem, isCompendiumItem);
  foundryItem = equipmentEffectAdjustment(foundryItem);
  if (foundryItem.effects?.length > 0)
    logger.debug(`Item effect ${foundryItem.name}:`, JSON.parse(JSON.stringify(foundryItem)));
  return foundryItem;
}

export function generateFeatEffects(ddb, character, ddbItem, foundryItem, isCompendiumItem) {
  foundryItem = generateGenericEffects(ddb, character, ddbItem, foundryItem, isCompendiumItem);
  foundryItem = featureEffectAdjustment(foundryItem);
  if (foundryItem.effects?.length > 0)
    logger.debug(`Feature effect ${foundryItem.name}:`, JSON.parse(JSON.stringify(foundryItem)));
  return foundryItem;
}

export function generateSpellEffects(ddb, character, ddbItem, foundryItem, isCompendiumItem) {
  foundryItem = generateGenericEffects(ddb, character, ddbItem, foundryItem, isCompendiumItem);
  foundryItem = spellEffectAdjustment(foundryItem);
  if (foundryItem.effects?.length > 0)
    logger.debug(`Spell effect ${foundryItem.name}:`, JSON.parse(JSON.stringify(foundryItem)));
  return foundryItem;
}
