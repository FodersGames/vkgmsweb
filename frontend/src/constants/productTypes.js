import { GameController, AppWindow, Wrench } from '@phosphor-icons/react';

// Single source of truth for the product-type taxonomy — comes straight from
// each game/app's own "Type" field (set in the admin's Games manager), used
// by the Shop's category tabs and the public Applications catalogue so the
// two never drift into hand-maintained duplicates of the same three labels.
export const TYPE_ORDER = ['game', 'application', 'software'];

export const TYPE_META = {
  game:        { label: 'Games',        icon: GameController },
  application: { label: 'Applications', icon: AppWindow },
  software:    { label: 'Software',     icon: Wrench },
};
