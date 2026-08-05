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

export const APP_TEMPLATES = [
  {
    id: 'counter',
    label: 'Tap Counter',
    tier: 'free',
    description: 'A number, and two buttons to change it. The smallest possible taste of variables + actions.',
    theme: 'mint',
    variables: [{ name: 'count', initial_value: '0' }],
    screens: [{
      id: 'home', name: 'Home',
      components: [
        { id: 'title', type: 'text', actions: {}, layout: { x: 24, y: 56, w: 312, h: 36 },
          props: { content: 'Tap Counter', size: 'lg', weight: 'bold', align: 'center', color: '' } },
        { id: 'value', type: 'text', actions: {}, layout: { x: 24, y: 240, w: 312, h: 64 },
          props: { content: '{{count}}', size: 'xl', weight: 'bold', align: 'center', color: '#4ECDC4' } },
        { id: 'minus', type: 'button', actions: { onClick: [{ type: 'set_variable', variable: 'count', value_mode: 'increment', value: '-1' }] },
          layout: { x: 24, y: 360, w: 150, h: 48 }, props: { label: '−1', style: 'outline' } },
        { id: 'plus', type: 'button', actions: { onClick: [{ type: 'set_variable', variable: 'count', value_mode: 'increment', value: '1' }] },
          layout: { x: 186, y: 360, w: 150, h: 48 }, props: { label: '+1', style: 'primary' } },
        { id: 'reset', type: 'button', actions: { onClick: [{ type: 'set_variable', variable: 'count', value_mode: 'literal', value: '0' }] },
          layout: { x: 24, y: 420, w: 312, h: 44 }, props: { label: 'Reset', style: 'secondary' } },
      ],
    }],
  },
  {
    id: 'profile',
    label: 'Simple Profile',
    tier: 'free',
    description: 'A photo, a name, a short bio and a contact button — the classic personal-page layout.',
    theme: 'mint',
    variables: [],
    screens: [{
      id: 'home', name: 'Profile',
      components: [
        { id: 'photo', type: 'image', actions: {}, layout: { x: 130, y: 48, w: 100, h: 100 }, props: { url: '', radius: 50 } },
        { id: 'name', type: 'text', actions: {}, layout: { x: 24, y: 160, w: 312, h: 30 },
          props: { content: 'Your Name', size: 'lg', weight: 'bold', align: 'center', color: '' } },
        { id: 'tagline', type: 'text', actions: {}, layout: { x: 24, y: 194, w: 312, h: 22 },
          props: { content: 'Your tagline here', size: 'sm', weight: 'normal', align: 'center', color: '' } },
        { id: 'bio-card', type: 'container', actions: {}, layout: { x: 24, y: 244, w: 312, h: 130 },
          props: { background: 'surface', border: true, radius: 16, shadow: false },
          children: [
            { id: 'bio-text', type: 'text', actions: {}, layout: { x: 16, y: 16, w: 280, h: 98 },
              props: { content: 'Write a short bio here — what you do, what you love, what makes you, you.', size: 'sm', weight: 'normal', align: 'left', color: '' } },
          ] },
        { id: 'contact', type: 'button', actions: { onClick: [{ type: 'open_link', url: 'mailto:you@example.com', new_tab: true }] },
          layout: { x: 24, y: 400, w: 312, h: 48 }, props: { label: 'Contact Me', style: 'primary' } },
      ],
    }],
  },
  {
    id: 'habits',
    label: 'Habit Tracker',
    tier: 'premium',
    description: 'A daily checklist with reminders — built with icons, a toggle and a live list.',
    theme: 'grape',
    variables: [
      { name: 'reminders', initial_value: 'true' },
      { name: 'habits', initial_value: '["Drink water","Read 10 pages","Meditate 5 min","Walk 20 min"]' },
    ],
    screens: [{
      id: 'home', name: 'Today',
      components: [
        { id: 'title', type: 'text', actions: {}, layout: { x: 24, y: 40, w: 260, h: 44 },
          props: { content: 'Today', size: 'custom', size_px: 32, weight: 'bold', align: 'left', color: '' } },
        { id: 'subtitle', type: 'text', actions: {}, layout: { x: 24, y: 86, w: 260, h: 22 },
          props: { content: '4 habits to complete', size: 'sm', weight: 'normal', align: 'left', color: '' } },
        { id: 'star-icon', type: 'icon', actions: {}, layout: { x: 300, y: 44, w: 36, h: 36 }, props: { icon: 'star', color: '' } },
        { id: 'reminders-toggle', type: 'toggle', actions: {}, layout: { x: 24, y: 132, w: 312, h: 32 },
          props: { label: 'Daily reminders', variable: 'reminders' } },
        { id: 'habits-list', type: 'list', actions: {}, layout: { x: 24, y: 184, w: 312, h: 280 },
          props: { source_variable: 'habits', item_template: '✓ {{item}}', empty_text: 'Add your first habit.' } },
        { id: 'add-habit', type: 'button', actions: {}, layout: { x: 24, y: 480, w: 312, h: 48 }, props: { label: 'Add Habit', style: 'primary' } },
      ],
    }],
  },
  {
    id: 'shopping',
    label: 'Shopping List',
    tier: 'premium',
    description: 'A running list with an add field and a "hide completed" switch.',
    theme: 'sunset',
    variables: [
      { name: 'hideDone', initial_value: 'false' },
      { name: 'newItem', initial_value: '' },
      { name: 'items', initial_value: '["Milk","Eggs","Bread","Coffee","Apples"]' },
    ],
    screens: [{
      id: 'home', name: 'List',
      components: [
        { id: 'cart-icon', type: 'icon', actions: {}, layout: { x: 24, y: 44, w: 36, h: 36 }, props: { icon: 'cart', color: '' } },
        { id: 'title', type: 'text', actions: {}, layout: { x: 70, y: 40, w: 220, h: 44 },
          props: { content: 'Shopping List', size: 'custom', size_px: 26, weight: 'bold', align: 'left', color: '' } },
        { id: 'hide-toggle', type: 'toggle', actions: {}, layout: { x: 24, y: 100, w: 312, h: 30 },
          props: { label: 'Hide completed items', variable: 'hideDone' } },
        { id: 'items-list', type: 'list', actions: {}, layout: { x: 24, y: 146, w: 312, h: 260 },
          props: { source_variable: 'items', item_template: '{{item}}', empty_text: 'Your list is empty.' } },
        { id: 'new-item', type: 'input', actions: {}, layout: { x: 24, y: 420, w: 220, h: 44 },
          props: { placeholder: 'Add an item…', variable: 'newItem' } },
        { id: 'add-item', type: 'button', actions: {}, layout: { x: 252, y: 420, w: 84, h: 44 }, props: { label: 'Add', style: 'primary' } },
      ],
    }],
  },
  {
    id: 'fitness',
    label: 'Fitness Dashboard',
    tier: 'premium',
    description: 'Big stat numbers, a workout log and a units switch — dark-themed for a sporty feel.',
    theme: 'midnight',
    variables: [
      { name: 'steps', initial_value: '6482' },
      { name: 'calories', initial_value: '412' },
      { name: 'metric', initial_value: 'true' },
      { name: 'workouts', initial_value: '["Morning run — 5.2 km","Push day — 45 min","Evening walk — 2.1 km"]' },
    ],
    screens: [{
      id: 'home', name: 'Dashboard',
      components: [
        { id: 'title', type: 'text', actions: {}, layout: { x: 24, y: 40, w: 260, h: 40 },
          props: { content: 'This Week', size: 'custom', size_px: 28, weight: 'bold', align: 'left', color: '' } },
        { id: 'steps-icon', type: 'icon', actions: {}, layout: { x: 24, y: 96, w: 28, h: 28 }, props: { icon: 'star', color: '' } },
        { id: 'steps-value', type: 'text', actions: {}, layout: { x: 60, y: 92, w: 130, h: 36 },
          props: { content: '{{steps}} steps', size: 'lg', weight: 'bold', align: 'left', color: '' } },
        { id: 'cal-icon', type: 'icon', actions: {}, layout: { x: 200, y: 96, w: 28, h: 28 }, props: { icon: 'heart', color: '' } },
        { id: 'cal-value', type: 'text', actions: {}, layout: { x: 236, y: 92, w: 100, h: 36 },
          props: { content: '{{calories}} kcal', size: 'md', weight: 'bold', align: 'left', color: '' } },
        { id: 'metric-toggle', type: 'toggle', actions: {}, layout: { x: 24, y: 150, w: 312, h: 30 },
          props: { label: 'Use metric units', variable: 'metric' } },
        { id: 'log-label', type: 'text', actions: {}, layout: { x: 24, y: 198, w: 260, h: 22 },
          props: { content: 'Recent workouts', size: 'sm', weight: 'bold', align: 'left', color: '' } },
        { id: 'workouts-list', type: 'list', actions: {}, layout: { x: 24, y: 226, w: 312, h: 230 },
          props: { source_variable: 'workouts', item_template: '{{item}}', empty_text: 'No workouts logged yet.' } },
        { id: 'log-button', type: 'button', actions: {}, layout: { x: 24, y: 470, w: 312, h: 48 }, props: { label: 'Log a Workout', style: 'primary' } },
      ],
    }],
  },
  {
    id: 'planner',
    label: 'Event Planner',
    tier: 'premium',
    description: 'An event page with an agenda list and a notify-me switch, ready to share.',
    theme: 'ocean',
    variables: [
      { name: 'notify', initial_value: 'true' },
      { name: 'agenda', initial_value: '["6:00 PM — Doors open","7:00 PM — Opening talk","8:30 PM — Networking"]' },
    ],
    screens: [{
      id: 'home', name: 'Event',
      components: [
        { id: 'cal-icon', type: 'icon', actions: {}, layout: { x: 24, y: 44, w: 36, h: 36 }, props: { icon: 'calendar', color: '' } },
        { id: 'title', type: 'text', actions: {}, layout: { x: 70, y: 40, w: 220, h: 44 },
          props: { content: 'My Event', size: 'custom', size_px: 26, weight: 'bold', align: 'left', color: '' } },
        { id: 'subtitle', type: 'text', actions: {}, layout: { x: 24, y: 96, w: 312, h: 22 },
          props: { content: 'Saturday, 7:00 PM · Community Hall', size: 'sm', weight: 'normal', align: 'left', color: '' } },
        { id: 'notify-toggle', type: 'toggle', actions: {}, layout: { x: 24, y: 140, w: 312, h: 30 },
          props: { label: 'Notify me about updates', variable: 'notify' } },
        { id: 'agenda-label', type: 'text', actions: {}, layout: { x: 24, y: 188, w: 260, h: 22 },
          props: { content: 'Agenda', size: 'sm', weight: 'bold', align: 'left', color: '' } },
        { id: 'agenda-list', type: 'list', actions: {}, layout: { x: 24, y: 216, w: 312, h: 240 },
          props: { source_variable: 'agenda', item_template: '{{item}}', empty_text: 'Agenda coming soon.' } },
        { id: 'share', type: 'button', actions: {}, layout: { x: 24, y: 470, w: 312, h: 48 }, props: { label: 'Share Event', style: 'primary' } },
      ],
    }],
  },
];

export const APP_TEMPLATE_MAP = Object.fromEntries(APP_TEMPLATES.map(t => [t.id, t]));
