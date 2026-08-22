import type { VRM } from "@pixiv/three-vrm";

export function getVrmMetaVersion(vrm: VRM) {
  return (vrm.meta as { metaVersion?: string } | null | undefined)?.metaVersion;
}

export function isVrm0(vrm: VRM) {
  return getVrmMetaVersion(vrm) === "0";
}
