import { Permissions, type PermissionKey } from '@/lib/permissions';

export const permissionCatalog: Array<{ key: PermissionKey; label: string; bit: bigint }> = [
  { key: 'ADMINISTRATOR', label: 'Administrateur', bit: Permissions.ADMINISTRATOR },
  { key: 'VIEW_CHANNEL', label: 'Voir les salons', bit: Permissions.VIEW_CHANNEL },
  { key: 'SEND_MESSAGES', label: 'Envoyer des messages', bit: Permissions.SEND_MESSAGES },
  { key: 'READ_MESSAGE_HISTORY', label: 'Historique des messages', bit: Permissions.READ_MESSAGE_HISTORY },
  { key: 'MANAGE_MESSAGES', label: 'Gérer les messages', bit: Permissions.MANAGE_MESSAGES },
  { key: 'ADD_REACTIONS', label: 'Ajouter des réactions', bit: Permissions.ADD_REACTIONS },
  { key: 'ATTACH_FILES', label: 'Joindre des fichiers', bit: Permissions.ATTACH_FILES },
  { key: 'EMBED_LINKS', label: 'Intégrer des liens', bit: Permissions.EMBED_LINKS },
  { key: 'MENTION_EVERYONE', label: 'Mentionner @everyone', bit: Permissions.MENTION_EVERYONE },
  { key: 'CONNECT', label: 'Se connecter (vocal)', bit: Permissions.CONNECT },
  { key: 'SPEAK', label: 'Parler (vocal)', bit: Permissions.SPEAK },
  { key: 'MUTE_MEMBERS', label: 'Rendre muet', bit: Permissions.MUTE_MEMBERS },
  { key: 'DEAFEN_MEMBERS', label: 'Rendre sourd', bit: Permissions.DEAFEN_MEMBERS },
  { key: 'MOVE_MEMBERS', label: 'Déplacer membres', bit: Permissions.MOVE_MEMBERS },
  { key: 'MODERATE_MEMBERS', label: 'Modérer membres', bit: Permissions.MODERATE_MEMBERS },
  { key: 'KICK_MEMBERS', label: 'Expulser membres', bit: Permissions.KICK_MEMBERS },
  { key: 'BAN_MEMBERS', label: 'Bannir membres', bit: Permissions.BAN_MEMBERS },
  { key: 'MANAGE_CHANNELS', label: 'Gérer salons', bit: Permissions.MANAGE_CHANNELS },
  { key: 'MANAGE_GUILD', label: 'Gérer serveur', bit: Permissions.MANAGE_GUILD },
  { key: 'MANAGE_ROLES', label: 'Gérer rôles', bit: Permissions.MANAGE_ROLES },
  { key: 'CREATE_INSTANT_INVITE', label: 'Créer invitations', bit: Permissions.CREATE_INSTANT_INVITE },
  { key: 'MANAGE_WEBHOOKS', label: 'Gérer webhooks', bit: Permissions.MANAGE_WEBHOOKS },
  { key: 'MANAGE_EMOJIS_AND_STICKERS', label: 'Gérer emojis/stickers', bit: Permissions.MANAGE_EMOJIS_AND_STICKERS }
];
