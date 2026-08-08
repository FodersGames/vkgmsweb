// Starter templates for the Studio App Builder — a real base to build from
// instead of an empty screen. 2 free, 4 requiring Vakar+ (enforced server-side
// too: studio_apps.py's create endpoints run the exact same _validate_tier
// check on a template's screens/theme as any other save, so a free-tier
// request can't sneak a premium template through even by tampering with the
// request body). IDs inside each template are fixed, human-readable strings
// (not genId()) — they only need to be unique within one app's component
// tree, not globally, and a module-level genId() call would hand every app
// created from the same template the same IDs anyway since it'd only run
// once at import time. Selecting a template clones it (see MyApps.js/
// AppBuilderList.js) so editing one created app never mutates this constant.
//
// Every element and switch below is genuinely wired, not decorative:
// - "Add"/"Log" buttons really run a `list_add` action reading the paired
//   input's bound variable.
// - Tapping a list row really runs its `item_action` — which can now be a
//   full multi-step chain (not just one action), e.g. Shopping List/Habit
//   Tracker/tap-to-complete move an item to a "done" list via list_remove
//   + list_add together, using the {{index}} the item_action scope
//   provides (see AppRuntime.js's list case / exportApp.js's renderList).
// - Toggles that used to just flip a variable with no visible effect
//   (Shopping List's "hide completed", Fitness's "metric units") now
//   really control something: a declarative `visible_if` condition on the
//   affected components, re-evaluated live — no action wiring needed for
//   this part, visible_if reacts to the variable on every render.
// - Toggles/ratings that don't have a natural UI effect (Habit reminders,
//   Event notify, Event rating) at least confirm the change via a
//   `show_message` onChange action, so nothing feels like a dead switch.
//
// Every template now has TWO screens, not one: a preference toggle that
// used to just sit inline on the main screen now lives on its own Settings
// screen (appbar back button + a small gear-icon FAB on the main screen to
// reach it) — a real navigation flow, not a decorative extra screen. Key
// entrance elements use `props.animation` (fade/slide-up/pop — see
// AppRuntime.js/exportApp.js's .vk-anim-* classes) so opening the app
// actually feels designed, not static.
//
// Fitness genuinely tracks steps now, not a hardcoded "6482" that never
// moves: `pedometer_start` (see frontend/src/appBuilderBlock/{blocks,
// runtime}.js and the native Android plugin build-apk.yml injects for any
// app using it) keeps the `steps` variable live from the phone's own step
// sensor. In the editor/live-preview/public web page — anywhere without
// that native plugin — it safely reports 0 rather than erroring, which is
// exactly what the app's own explanatory text below says.

// Shared by the Fitness template's "recalculate" flow (onOpen, the Refresh
// button, after logging a workout, and Settings' Save & Back) — distance
// and calories are a real computed estimate from live step count and the
// visitor's own weight, not another hardcoded number, but they're not
// wired to recompute on every single step tick (the action model here is
// imperative, not reactive) so this chain is re-run at each of those
// natural checkpoints instead. `_calTemp` is just scratch space for the
// two-step multiply/divide chains `calculate` (one operator at a time)
// can't do in a single action.
const RECALC_FITNESS_STATS = [
  { type: 'calculate', variable: 'distanceKm', op: 'multiply', a: 'steps', b: 0.000762 },
  { type: 'calculate', variable: 'distanceMiles', op: 'multiply', a: 'distanceKm', b: 0.621371 },
  { type: 'calculate', variable: '_calTemp', op: 'multiply', a: 'distanceKm', b: 'weightKg' },
  { type: 'calculate', variable: 'calories', op: 'multiply', a: '_calTemp', b: 0.9 },
  { type: 'calculate', variable: '_calTemp', op: 'divide', a: 'steps', b: 'stepsGoal' },
  { type: 'calculate', variable: 'stepsGoalPct', op: 'multiply', a: '_calTemp', b: 100 },
];

export const APP_TEMPLATES = [
  {
    id: 'counter',
    label: 'Tap Counter',
    tier: 'free',
    description: 'A number, and two buttons to change it — plus a second screen explaining how variables + actions work.',
    theme: 'mint',
    variables: [{ name: 'count', initial_value: '0' }],
    screens: [
      {
        id: 'home', name: 'Home',
        components: [
          { id: 'appbar', type: 'appbar', actions: {}, layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } },
            props: { title: 'Tap Counter', show_back: false } },
          { id: 'about-fab', type: 'fab', actions: { onClick: [{ type: 'navigate', screen_id: 'about' }] },
            layout: { x: 284, y: 524, w: 56, h: 56, anchors: { right: 20, bottom: 20 } }, props: { icon: 'settings', color: '' } },
          { id: 'value', type: 'text', actions: {}, layout: { x: 24, y: 240, w: 312, h: 64 },
            props: { content: '{{count}}', size: 'xl', weight: 'bold', align: 'center', color: '#4ECDC4', animation: 'pop' } },
          { id: 'minus', type: 'button', actions: { onClick: [{ type: 'set_variable', variable: 'count', value_mode: 'increment', value: '-1' }] },
            layout: { x: 24, y: 360, w: 150, h: 48 }, props: { label: '−1', style: 'outline', animation: 'slide-up' } },
          { id: 'plus', type: 'button', actions: { onClick: [{ type: 'set_variable', variable: 'count', value_mode: 'increment', value: '1' }] },
            layout: { x: 186, y: 360, w: 150, h: 48 }, props: { label: '+1', style: 'primary', animation: 'slide-up' } },
          { id: 'reset', type: 'button', actions: { onClick: [{ type: 'set_variable', variable: 'count', value_mode: 'literal', value: '0' }] },
            layout: { x: 24, y: 420, w: 312, h: 44 }, props: { label: 'Reset', style: 'secondary' } },
        ],
      },
      {
        id: 'about', name: 'About',
        components: [
          { id: 'appbar', type: 'appbar', actions: { onClick: [{ type: 'navigate', screen_id: 'home' }] },
            layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } }, props: { title: 'How this works', show_back: true } },
          { id: 'body', type: 'text', actions: {}, layout: { x: 24, y: 80, w: 312, h: 420 },
            props: {
              content: 'count is a variable — a number the app remembers.\n\nEach button runs an action when tapped: −1 and +1 change count, Reset sets it back to 0.\n\nEverything else you build is the same two ideas — variables that remember things, and actions that change them — just with more variables and fancier actions.',
              size: 'md', weight: 'normal', align: 'left', color: '', animation: 'fade',
            } },
        ],
      },
    ],
  },
  {
    id: 'profile',
    label: 'Simple Profile',
    tier: 'free',
    description: 'A photo, a name, a short bio and a contact button — plus a second screen for the fuller story.',
    theme: 'mint',
    variables: [],
    screens: [
      {
        id: 'home', name: 'Profile',
        components: [
          { id: 'photo', type: 'image', actions: {}, layout: { x: 130, y: 48, w: 100, h: 100 }, props: { url: '', radius: 50, animation: 'pop' } },
          { id: 'name', type: 'text', actions: {}, layout: { x: 24, y: 160, w: 312, h: 30 },
            props: { content: 'Your Name', size: 'lg', weight: 'bold', align: 'center', color: '', animation: 'fade' } },
          { id: 'tagline', type: 'text', actions: {}, layout: { x: 24, y: 194, w: 312, h: 22 },
            props: { content: 'Your tagline here', size: 'sm', weight: 'normal', align: 'center', color: '', animation: 'fade' } },
          { id: 'bio-card', type: 'container', actions: {}, layout: { x: 24, y: 244, w: 312, h: 130 },
            props: { background: 'surface', border: true, radius: 16, shadow: false, animation: 'slide-up' },
            children: [
              { id: 'bio-text', type: 'text', actions: {}, layout: { x: 16, y: 16, w: 280, h: 98 },
                props: { content: 'Write a short bio here — what you do, what you love, what makes you, you.', size: 'sm', weight: 'normal', align: 'left', color: '' } },
            ] },
          { id: 'more-about', type: 'button', actions: { onClick: [{ type: 'navigate', screen_id: 'about' }] },
            layout: { x: 24, y: 388, w: 312, h: 40 }, props: { label: 'More About Me', style: 'outline' } },
          { id: 'contact', type: 'button', actions: { onClick: [{ type: 'open_link', url: 'mailto:you@example.com', new_tab: true }] },
            layout: { x: 24, y: 440, w: 312, h: 48 }, props: { label: 'Contact Me', style: 'primary' } },
        ],
      },
      {
        id: 'about', name: 'More About Me',
        components: [
          { id: 'appbar', type: 'appbar', actions: { onClick: [{ type: 'navigate', screen_id: 'home' }] },
            layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } }, props: { title: 'More About Me', show_back: true } },
          { id: 'extended-bio', type: 'text', actions: {}, layout: { x: 24, y: 80, w: 312, h: 240 },
            props: { content: 'Write the fuller story here — background, what you’re working on, what you’re looking for. This screen is a good place for the details that don’t fit on the main card.', size: 'md', weight: 'normal', align: 'left', color: '', animation: 'fade' } },
          { id: 'links-label', type: 'text', actions: {}, layout: { x: 24, y: 332, w: 260, h: 20 },
            props: { content: 'Find me elsewhere', size: 'sm', weight: 'bold', align: 'left', color: '' } },
          { id: 'link-website', type: 'button', actions: { onClick: [{ type: 'open_link', url: 'https://example.com', new_tab: true }] },
            layout: { x: 24, y: 358, w: 312, h: 44 }, props: { label: 'Website', style: 'outline' } },
        ],
      },
    ],
  },
  {
    id: 'habits',
    label: 'Habit Tracker',
    tier: 'premium',
    description: 'A daily checklist with reminders — type a habit, add it, tap it when done. Reminders now live on their own Settings screen.',
    theme: 'grape',
    variables: [
      { name: 'reminders', initial_value: 'true' },
      { name: 'newHabit', initial_value: '' },
      { name: 'habits', initial_value: '["Drink water","Read 10 pages","Meditate 5 min","Walk 20 min"]' },
      { name: 'doneHabits', initial_value: '[]' },
    ],
    screens: [
      {
        id: 'home', name: 'Today',
        components: [
          { id: 'title', type: 'text', actions: {}, layout: { x: 24, y: 40, w: 260, h: 44 },
            props: { content: 'Today', size: 'custom', size_px: 32, weight: 'bold', align: 'left', color: '', animation: 'fade' } },
          { id: 'subtitle', type: 'text', actions: {}, layout: { x: 24, y: 86, w: 260, h: 22 },
            props: { content: 'Tap a habit once it’s done', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          { id: 'settings-fab', type: 'fab', actions: { onClick: [{ type: 'navigate', screen_id: 'settings' }] },
            layout: { x: 284, y: 524, w: 56, h: 56, anchors: { right: 20, bottom: 20 } }, props: { icon: 'settings', color: '' } },
          { id: 'habits-list', type: 'list', actions: {}, layout: { x: 24, y: 130, w: 312, h: 170 },
            props: {
              source_variable: 'habits', item_template: '{{item}}', empty_text: 'Add your first habit below.',
              animation: 'slide-up',
              item_action: [
                { type: 'list_remove', variable: 'habits', mode: 'at_index', index: '{{index}}' },
                { type: 'list_add', variable: 'doneHabits', mode: 'append', value_mode: 'literal', value: '{{item}}' },
              ],
            } },
          { id: 'done-label', type: 'text', actions: {}, layout: { x: 24, y: 308, w: 260, h: 20 },
            props: { content: 'Completed today', size: 'sm', weight: 'bold', align: 'left', color: '' } },
          { id: 'done-habits-list', type: 'list', actions: {}, layout: { x: 24, y: 332, w: 312, h: 90 },
            props: {
              source_variable: 'doneHabits', item_template: '✓ {{item}}', empty_text: 'Nothing completed yet — tap a habit above.',
              item_action: [
                { type: 'list_remove', variable: 'doneHabits', mode: 'at_index', index: '{{index}}' },
                { type: 'list_add', variable: 'habits', mode: 'append', value_mode: 'literal', value: '{{item}}' },
              ],
            } },
          { id: 'new-habit', type: 'input', actions: {}, layout: { x: 24, y: 436, w: 220, h: 44 },
            props: { placeholder: 'New habit…', variable: 'newHabit' } },
          { id: 'add-habit', type: 'button', actions: { onClick: [
            { type: 'list_add', variable: 'habits', mode: 'append', value_mode: 'variable', value: 'newHabit' },
            { type: 'set_variable', variable: 'newHabit', value_mode: 'literal', value: '' },
          ] }, layout: { x: 252, y: 436, w: 84, h: 44 }, props: { label: 'Add', style: 'primary' } },
        ],
      },
      {
        id: 'settings', name: 'Settings',
        components: [
          { id: 'appbar', type: 'appbar', actions: { onClick: [{ type: 'navigate', screen_id: 'home' }] },
            layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } }, props: { title: 'Settings', show_back: true } },
          { id: 'reminders-toggle', type: 'toggle',
            actions: { onChange: [{ type: 'show_message', text: 'Daily reminders updated.' }] },
            layout: { x: 24, y: 92, w: 312, h: 32 }, props: { label: 'Daily reminders', variable: 'reminders' } },
          { id: 'note', type: 'text', actions: {}, layout: { x: 24, y: 140, w: 312, h: 60 },
            props: { content: 'A daily reminder nudges you to check in on your habits.', size: 'sm', weight: 'normal', align: 'left', color: '' } },
        ],
      },
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping List',
    tier: 'premium',
    description: 'A running list with an add field — type an item, tap Add, it’s really added. "Hide completed" now lives on its own Settings screen.',
    theme: 'sunset',
    variables: [
      { name: 'hideDone', initial_value: 'false' },
      { name: 'newItem', initial_value: '' },
      { name: 'items', initial_value: '["Milk","Eggs","Bread","Coffee","Apples"]' },
      { name: 'doneItems', initial_value: '[]' },
    ],
    screens: [
      {
        id: 'home', name: 'List',
        components: [
          { id: 'cart-icon', type: 'icon', actions: {}, layout: { x: 24, y: 44, w: 36, h: 36 }, props: { icon: 'cart', color: '' } },
          { id: 'title', type: 'text', actions: {}, layout: { x: 70, y: 40, w: 220, h: 44 },
            props: { content: 'Shopping List', size: 'custom', size_px: 26, weight: 'bold', align: 'left', color: '', animation: 'fade' } },
          { id: 'settings-fab', type: 'fab', actions: { onClick: [{ type: 'navigate', screen_id: 'settings' }] },
            layout: { x: 284, y: 524, w: 56, h: 56, anchors: { right: 20, bottom: 20 } }, props: { icon: 'settings', color: '' } },
          { id: 'items-list', type: 'list', actions: {}, layout: { x: 24, y: 100, w: 312, h: 170 },
            props: {
              source_variable: 'items', item_template: '{{item}}', empty_text: 'Your list is empty — add something below.',
              animation: 'slide-up',
              // Tapping an item really moves it to the Completed section below
              // (list_remove here + list_add into doneItems) — not just deleted.
              item_action: [
                { type: 'list_remove', variable: 'items', mode: 'at_index', index: '{{index}}' },
                { type: 'list_add', variable: 'doneItems', mode: 'append', value_mode: 'literal', value: '{{item}}' },
              ],
            } },
          // Both hidden together by the "Hide completed items" toggle on the
          // Settings screen — a real, working effect (declarative visible_if,
          // re-evaluated live against hideDone), not just a switch that flips
          // and does nothing.
          { id: 'completed-label', type: 'text', actions: {}, layout: { x: 24, y: 278, w: 260, h: 20 },
            visible_if: { variable: 'hideDone', op: 'eq', value: 'false' },
            props: { content: 'Completed', size: 'sm', weight: 'bold', align: 'left', color: '' } },
          { id: 'done-items-list', type: 'list', actions: {}, layout: { x: 24, y: 302, w: 312, h: 100 },
            visible_if: { variable: 'hideDone', op: 'eq', value: 'false' },
            props: {
              source_variable: 'doneItems', item_template: '✓ {{item}}', empty_text: 'Nothing completed yet.',
              item_action: [
                { type: 'list_remove', variable: 'doneItems', mode: 'at_index', index: '{{index}}' },
                { type: 'list_add', variable: 'items', mode: 'append', value_mode: 'literal', value: '{{item}}' },
              ],
            } },
          { id: 'new-item', type: 'input', actions: {}, layout: { x: 24, y: 416, w: 220, h: 44 },
            props: { placeholder: 'Add an item…', variable: 'newItem' } },
          { id: 'add-item', type: 'button', actions: { onClick: [
            { type: 'list_add', variable: 'items', mode: 'append', value_mode: 'variable', value: 'newItem' },
            { type: 'set_variable', variable: 'newItem', value_mode: 'literal', value: '' },
          ] }, layout: { x: 252, y: 416, w: 84, h: 44 }, props: { label: 'Add', style: 'primary' } },
        ],
      },
      {
        id: 'settings', name: 'Settings',
        components: [
          { id: 'appbar', type: 'appbar', actions: { onClick: [{ type: 'navigate', screen_id: 'home' }] },
            layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } }, props: { title: 'Settings', show_back: true } },
          { id: 'hide-toggle', type: 'toggle', actions: {}, layout: { x: 24, y: 92, w: 312, h: 30 },
            props: { label: 'Hide completed items', variable: 'hideDone' } },
          { id: 'note', type: 'text', actions: {}, layout: { x: 24, y: 140, w: 312, h: 60 },
            props: { content: 'Hides the Completed section on the main list so you can focus on what’s left to buy.', size: 'sm', weight: 'normal', align: 'left', color: '' } },
        ],
      },
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness Dashboard',
    tier: 'premium',
    description: 'Real step tracking from your phone’s own sensor (built Android app), calorie/distance estimates, a workout log, and a daily-goal progress bar — dark-themed for a sporty feel.',
    theme: 'midnight',
    variables: [
      { name: 'steps', initial_value: '0' },
      { name: 'stepsGoal', initial_value: '8000' },
      { name: 'stepsGoalPct', initial_value: '0' },
      { name: 'calories', initial_value: '0' },
      { name: 'metric', initial_value: 'true' },
      { name: 'distanceKm', initial_value: '0' },
      { name: 'distanceMiles', initial_value: '0' },
      { name: 'weightKg', initial_value: '70' },
      { name: 'newWorkout', initial_value: '' },
      { name: 'workouts', initial_value: '["Morning run — 5.2 km","Push day — 45 min","Evening walk — 2.1 km"]' },
      // Scratch space for RECALC_FITNESS_STATS's two-step multiply/divide
      // chains — not meant to be shown anywhere in the UI.
      { name: '_calTemp', initial_value: '0' },
    ],
    screens: [
      {
        id: 'home', name: 'Dashboard',
        // Starts real step tracking the moment the dashboard opens (see
        // ab_pedometer_start's own runtime — safely does nothing outside a
        // built Android app), then gives the sensor a couple seconds to
        // report a first reading before computing distance/calories/goal%
        // from it.
        actions: { onOpen: [
          { type: 'pedometer_start', variable: 'steps' },
          { type: 'wait', duration_ms: 2000 },
          ...RECALC_FITNESS_STATS,
        ] },
        components: [
          { id: 'appbar', type: 'appbar', actions: {}, layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } },
            props: { title: 'This Week', show_back: false } },
          { id: 'settings-fab', type: 'fab', actions: { onClick: [{ type: 'navigate', screen_id: 'settings' }] },
            layout: { x: 284, y: 524, w: 56, h: 56, anchors: { right: 20, bottom: 20 } }, props: { icon: 'settings', color: '' } },
          { id: 'steps-icon', type: 'icon', actions: {}, layout: { x: 24, y: 76, w: 28, h: 28 }, props: { icon: 'star', color: '' } },
          // Two alternate versions, only one ever visible — the "Use metric
          // units" toggle on Settings genuinely switches which one shows
          // (declarative visible_if, live against the `metric` variable).
          { id: 'steps-value-metric', type: 'text', actions: {}, layout: { x: 60, y: 72, w: 260, h: 36 },
            visible_if: { variable: 'metric', op: 'eq', value: 'true' },
            props: { content: '{{steps}} steps · {{distanceKm}} km', size: 'md', weight: 'bold', align: 'left', color: '', animation: 'fade' } },
          { id: 'steps-value-imperial', type: 'text', actions: {}, layout: { x: 60, y: 72, w: 260, h: 36 },
            visible_if: { variable: 'metric', op: 'eq', value: 'false' },
            props: { content: '{{steps}} steps · {{distanceMiles}} mi', size: 'md', weight: 'bold', align: 'left', color: '', animation: 'fade' } },
          { id: 'cal-icon', type: 'icon', actions: {}, layout: { x: 24, y: 118, w: 28, h: 28 }, props: { icon: 'heart', color: '' } },
          { id: 'cal-value', type: 'text', actions: {}, layout: { x: 60, y: 114, w: 260, h: 36 },
            props: { content: '{{calories}} kcal (est.)', size: 'md', weight: 'bold', align: 'left', color: '', animation: 'fade' } },
          { id: 'goal-label', type: 'text', actions: {}, layout: { x: 24, y: 162, w: 260, h: 18 },
            props: { content: 'Daily step goal — {{stepsGoal}} steps', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          { id: 'goal-progress', type: 'progress', actions: {}, layout: { x: 24, y: 184, w: 312, h: 10 },
            props: { variable: 'stepsGoalPct', value: 0 } },
          { id: 'refresh-button', type: 'button', actions: { onClick: [...RECALC_FITNESS_STATS] },
            layout: { x: 24, y: 208, w: 312, h: 36 }, props: { label: 'Refresh calories & goal', style: 'outline' } },
          { id: 'sensor-note', type: 'text', actions: {}, layout: { x: 24, y: 252, w: 312, h: 36 },
            props: { content: 'Steps come from your phone’s own step sensor — install the built Android app to see a live count.', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          { id: 'log-label', type: 'text', actions: {}, layout: { x: 24, y: 296, w: 260, h: 22 },
            props: { content: 'Recent workouts', size: 'sm', weight: 'bold', align: 'left', color: '' } },
          { id: 'workouts-list', type: 'list', actions: {}, layout: { x: 24, y: 324, w: 312, h: 150 },
            props: {
              source_variable: 'workouts', item_template: '{{item}}', empty_text: 'No workouts logged yet.',
              animation: 'slide-up',
              item_action: { type: 'list_remove', variable: 'workouts', mode: 'at_index', index: '{{index}}' },
            } },
          { id: 'new-workout', type: 'input', actions: {}, layout: { x: 24, y: 486, w: 220, h: 44 },
            props: { placeholder: 'e.g. Leg day — 40 min', variable: 'newWorkout' } },
          { id: 'log-button', type: 'button', actions: { onClick: [
            { type: 'list_add', variable: 'workouts', mode: 'prepend', value_mode: 'variable', value: 'newWorkout' },
            { type: 'set_variable', variable: 'newWorkout', value_mode: 'literal', value: '' },
          ] }, layout: { x: 252, y: 486, w: 84, h: 44 }, props: { label: 'Log', style: 'primary' } },
        ],
      },
      {
        id: 'settings', name: 'Settings',
        // Recomputes with the (possibly just-changed) weight before heading
        // back, so the dashboard reflects it immediately.
        components: [
          { id: 'appbar', type: 'appbar', actions: { onClick: [...RECALC_FITNESS_STATS, { type: 'navigate', screen_id: 'home' }] },
            layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } }, props: { title: 'Settings', show_back: true } },
          { id: 'weight-label', type: 'text', actions: {}, layout: { x: 24, y: 88, w: 312, h: 40 },
            props: { content: 'Your weight (kg) — used to estimate calories burned', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          { id: 'weight-input', type: 'input', actions: {}, layout: { x: 24, y: 132, w: 150, h: 44 },
            props: { placeholder: '70', variable: 'weightKg', input_type: 'number' } },
          { id: 'goal-label', type: 'text', actions: {}, layout: { x: 24, y: 196, w: 312, h: 40 },
            props: { content: 'Daily step goal', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          { id: 'goal-input', type: 'input', actions: {}, layout: { x: 24, y: 240, w: 150, h: 44 },
            props: { placeholder: '8000', variable: 'stepsGoal', input_type: 'number' } },
          { id: 'metric-toggle', type: 'toggle', actions: {}, layout: { x: 24, y: 304, w: 312, h: 30 },
            props: { label: 'Use metric units', variable: 'metric' } },
          { id: 'save-button', type: 'button', actions: { onClick: [...RECALC_FITNESS_STATS, { type: 'navigate', screen_id: 'home' }] },
            layout: { x: 24, y: 360, w: 312, h: 48 }, props: { label: 'Save & Back', style: 'primary' } },
        ],
      },
    ],
  },
  {
    id: 'planner',
    label: 'Event Planner',
    tier: 'premium',
    description: 'An event page with a real agenda list and a rating for last time — the "notify me" switch now lives on its own Settings screen.',
    theme: 'ocean',
    variables: [
      { name: 'notify', initial_value: 'true' },
      { name: 'newAgendaItem', initial_value: '' },
      { name: 'agenda', initial_value: '["6:00 PM — Doors open","7:00 PM — Opening talk","8:30 PM — Networking"]' },
      { name: 'lastRating', initial_value: '0' },
    ],
    screens: [
      {
        id: 'home', name: 'Event',
        components: [
          { id: 'cal-icon', type: 'icon', actions: {}, layout: { x: 24, y: 40, w: 32, h: 32 }, props: { icon: 'calendar', color: '' } },
          { id: 'title', type: 'text', actions: {}, layout: { x: 66, y: 36, w: 220, h: 40 },
            props: { content: 'My Event', size: 'custom', size_px: 24, weight: 'bold', align: 'left', color: '', animation: 'fade' } },
          { id: 'settings-fab', type: 'fab', actions: { onClick: [{ type: 'navigate', screen_id: 'settings' }] },
            layout: { x: 284, y: 524, w: 56, h: 56, anchors: { right: 20, bottom: 20 } }, props: { icon: 'settings', color: '' } },
          { id: 'subtitle', type: 'text', actions: {}, layout: { x: 24, y: 84, w: 312, h: 20 },
            props: { content: 'Saturday, 7:00 PM · Community Hall', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          { id: 'agenda-label', type: 'text', actions: {}, layout: { x: 24, y: 124, w: 260, h: 20 },
            props: { content: 'Agenda — tap an item once it’s done', size: 'sm', weight: 'bold', align: 'left', color: '' } },
          { id: 'agenda-list', type: 'list', actions: {}, layout: { x: 24, y: 148, w: 312, h: 190 },
            props: {
              source_variable: 'agenda', item_template: '{{item}}', empty_text: 'Agenda coming soon.',
              animation: 'slide-up',
              item_action: { type: 'list_remove', variable: 'agenda', mode: 'at_index', index: '{{index}}' },
            } },
          { id: 'new-agenda', type: 'input', actions: {}, layout: { x: 24, y: 348, w: 220, h: 40 },
            props: { placeholder: 'Add an agenda item…', variable: 'newAgendaItem' } },
          { id: 'add-agenda', type: 'button', actions: { onClick: [
            { type: 'list_add', variable: 'agenda', mode: 'append', value_mode: 'variable', value: 'newAgendaItem' },
            { type: 'set_variable', variable: 'newAgendaItem', value_mode: 'literal', value: '' },
          ] }, layout: { x: 252, y: 348, w: 84, h: 40 }, props: { label: 'Add', style: 'secondary' } },
          { id: 'rating-label', type: 'text', actions: {}, layout: { x: 24, y: 402, w: 260, h: 20 },
            props: { content: 'Rate the last event', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          { id: 'rating', type: 'rating',
            actions: { onChange: [{ type: 'show_message', text: 'Thanks for your rating!' }] },
            layout: { x: 24, y: 426, w: 160, h: 28 }, props: { variable: 'lastRating', max: 5, color: '' } },
          { id: 'share', type: 'button', actions: { onClick: [{ type: 'show_message', text: 'Link copied to clipboard!' }] },
            layout: { x: 24, y: 468, w: 312, h: 48 }, props: { label: 'Share Event', style: 'primary' } },
        ],
      },
      {
        id: 'settings', name: 'Settings',
        components: [
          { id: 'appbar', type: 'appbar', actions: { onClick: [{ type: 'navigate', screen_id: 'home' }] },
            layout: { x: 0, y: 0, w: 360, h: 56, anchors: { left: 0, right: 0, top: 0 } }, props: { title: 'Settings', show_back: true } },
          { id: 'notify-toggle', type: 'toggle',
            actions: { onChange: [{ type: 'show_message', text: 'Preference saved.' }] },
            layout: { x: 24, y: 92, w: 312, h: 30 }, props: { label: 'Notify me about updates', variable: 'notify' } },
          { id: 'note', type: 'text', actions: {}, layout: { x: 24, y: 140, w: 312, h: 60 },
            props: { content: 'Get a heads-up if the schedule or venue changes.', size: 'sm', weight: 'normal', align: 'left', color: '' } },
        ],
      },
    ],
  },
];

export const APP_TEMPLATE_MAP = Object.fromEntries(APP_TEMPLATES.map(t => [t.id, t]));
