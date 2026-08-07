import * as Blockly from 'blockly/core';

// App Builder Blocks — dynamic target/screen dropdown fields.
//
// Vakar Block's own sprite-target fields (vk_go_to's TARGET etc.) are plain
// free-text `field_input` — acceptable there since a typo just means "no
// sprite by that name" at runtime. That's not acceptable here: App Builder
// already computes reliable target pickers (flattenUpdatableTargets/
// flattenAllTargets in AppBuilderEditor.js) specifically so a stray typo'd
// component id can't silently no-op. These two fields read from a
// module-level registry instead, refreshed by AppBuilderBlockPanel
// (AppBuilderEditor.js) whenever the selected screen's component tree
// changes — Blockly's FieldDropdown already re-invokes a function-valued
// menu generator every time the dropdown is opened, so this is "dynamic" in
// exactly the same sense as Blockly's own built-in `custom: 'VARIABLE'`
// toolbox category, just applied to a field instead of a flyout.
let _components = [];
let _updatableIds = null; // Set|null — null means "no filter" (any component)
let _screens = [];
let _secretNames = [];

export function setAbBlockContext({ components = [], updatableIds = null, screens = [], secretNames = [] } = {}) {
  _components = components;
  _updatableIds = updatableIds;
  _screens = screens;
  _secretNames = secretNames;
}

function targetOptions(updatableOnly) {
  const list = updatableOnly && _updatableIds
    ? _components.filter(c => _updatableIds.has(c.id))
    : _components;
  if (!list.length) return [['(no components on this screen)', '']];
  return list.map(c => [c.label, c.id]);
}

function screenOptions() {
  if (!_screens.length) return [['(no screens)', '']];
  return _screens.map(s => [s.name || 'Screen', s.id]);
}

export class AbTargetField extends Blockly.FieldDropdown {
  constructor(updatableOnly, opt_validator, opt_config) {
    super(() => targetOptions(updatableOnly), opt_validator, opt_config);
    this.updatableOnly_ = !!updatableOnly;
  }
  static fromJson(options) {
    return new AbTargetField(!!options['updatable']);
  }
}
Blockly.fieldRegistry.register('field_ab_target', AbTargetField);

export class AbScreenField extends Blockly.FieldDropdown {
  constructor(opt_validator, opt_config) {
    super(() => screenOptions(), opt_validator, opt_config);
  }
  static fromJson() {
    return new AbScreenField();
  }
}
Blockly.fieldRegistry.register('field_ab_screen', AbScreenField);

function secretOptions() {
  if (!_secretNames.length) return [['(no keys yet — see Integrations)', '']];
  return _secretNames.map(n => [n, n]);
}

export class AbSecretField extends Blockly.FieldDropdown {
  constructor(opt_validator, opt_config) {
    super(() => secretOptions(), opt_validator, opt_config);
  }
  static fromJson() {
    return new AbSecretField();
  }
}
Blockly.fieldRegistry.register('field_ab_secret', AbSecretField);
