
import { Blobatar } from "@blobatar/react";
import "blobatar/motion.css";

type BlobatarAvatarProps = {
  name: string;
  animate?: "hover" | "always";
  size?: number;
};

export function BlobatarAvatar({
  name,
  animate = "hover",
  size = 64,
}: BlobatarAvatarProps) {
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <Blobatar name={name} animate={animate} />
    </div>
  );
}
