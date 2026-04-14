import { getAvatarOption } from '@/data/avatars';

interface AvatarVisualProps {
  avatarId?: number | null;
  className?: string;
  imageClassName?: string;
}

export const AvatarVisual = ({ avatarId, className = '', imageClassName = '' }: AvatarVisualProps) => {
  const avatar = getAvatarOption(avatarId);

  if (avatar.kind === 'image' && avatar.src) {
    return (
      <img
        src={avatar.src}
        alt={avatar.name}
        draggable={false}
        className={`block select-none object-contain ${className} ${imageClassName}`}
      />
    );
  }

  return <span className={`leading-none select-none ${className}`}>{avatar.emoji}</span>;
};
