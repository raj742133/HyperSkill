/**
 * The single authorisation function. Every service that touches a user-owned resource calls it.
 * Roles in v1: only "user". A user may act on a resource only if they own it.
 */
const owns = (user, resource) => resource != null && resource.user_id === user.id;

const RULES = {
  "assignment:create": () => true,
  "assignment:read": owns,
  "assignment:update": owns,
  "assignment:delete": owns,
};

export function can(user, action, resource) {
  if (!user || !user.id) return false;
  const rule = RULES[action];
  return rule ? rule(user, resource) === true : false;
}

export const ACTIONS = Object.keys(RULES);
