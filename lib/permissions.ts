export const Permissions = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  MODERATE_MEMBERS: 1n << 40n
} as const;

export type PermissionKey = keyof typeof Permissions;

export function hasPermission(memberPermissions: bigint, permission: bigint): boolean {
  if ((memberPermissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return true;
  return (memberPermissions & permission) === permission;
}

export function computeMemberPermissions(
  member: { roles: { role: { permissions: bigint } }[] },
  everyoneRole: { permissions: bigint }
): bigint {
  let permissions = everyoneRole.permissions;
  for (const { role } of member.roles) {
    permissions |= role.permissions;
  }
  return permissions;
}

export function computeChannelPermissions(
  basePermissions: bigint,
  overwrites: { type: 'ROLE' | 'MEMBER'; targetId: string; allow: bigint; deny: bigint }[],
  memberRoleIds: string[],
  memberId: string,
  everyoneRoleId: string
): bigint {
  if ((basePermissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return basePermissions;

  let allow = 0n;
  let deny = 0n;

  const everyoneOverwrite = overwrites.find((o) => o.type === 'ROLE' && o.targetId === everyoneRoleId);
  if (everyoneOverwrite) {
    deny |= everyoneOverwrite.deny;
    allow |= everyoneOverwrite.allow;
  }

  for (const roleId of memberRoleIds) {
    const roleOverwrite = overwrites.find((o) => o.type === 'ROLE' && o.targetId === roleId);
    if (roleOverwrite) {
      deny |= roleOverwrite.deny;
      allow |= roleOverwrite.allow;
    }
  }

  const memberOverwrite = overwrites.find((o) => o.type === 'MEMBER' && o.targetId === memberId);
  if (memberOverwrite) {
    deny |= memberOverwrite.deny;
    allow |= memberOverwrite.allow;
  }

  return (basePermissions & ~deny) | allow;
}
