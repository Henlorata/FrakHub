import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {User} from "lucide-react";

interface UserAvatarProps {
  user: {
    avatar_url?: string | null;
    full_name?: string | null;
    email?: string | null;
  };
  className?: string;
  size?: number;
}

export function UserAvatar({user, className, size = 100}: UserAvatarProps) {
  const optimizedUrl = getOptimizedAvatarUrl(user.avatar_url || null, size);

  const getInitials = (name?: string | null) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Avatar className={className}>
      <AvatarImage
        src={optimizedUrl}
        alt={user.full_name || "User"}
        className="object-cover"
      />
      <AvatarFallback className="bg-slate-800 text-slate-400 font-mono">
        {user.full_name ? getInitials(user.full_name) : <User className="w-4 h-4"/>}
      </AvatarFallback>
    </Avatar>
  );
}