/**
 * Kalender-UI (dunkel): scharfe Kanten, Rausch-Red-Akzent, klare Hover-Zustände.
 */
const darkLift =
  "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_14px_rgba(0,0,0,0.5)]";

export const calBtnPrimary = `inline-flex cursor-pointer items-center justify-center rounded-none bg-[#ff385c] px-6 py-2.5 text-sm font-semibold text-white ${darkLift} transition hover:bg-[#ff5a7a] hover:shadow-[0_0_0_1px_rgba(255,90,122,0.45),0_4px_20px_rgba(255,56,92,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff385c] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;

export const calBtnPrimarySm = `inline-flex cursor-pointer items-center justify-center rounded-none bg-[#ff385c] px-4 py-1.5 text-xs font-semibold text-white ${darkLift} transition hover:bg-[#ff5a7a] hover:shadow-[0_0_0_1px_rgba(255,90,122,0.4),0_4px_16px_rgba(255,56,92,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff385c] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;

export const calBtnGhost = `inline-flex cursor-pointer items-center justify-center rounded-none border border-[#3f3f48] bg-[#16161a] px-4 py-2 text-sm font-semibold text-[#ececf1] transition hover:border-[#ff385c]/45 hover:bg-[#222228] hover:text-[#ff8fa3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff385c]/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;

export const calBtnDangerGhost = `inline-flex cursor-pointer items-center justify-center rounded-none border border-transparent bg-transparent px-3 py-1.5 text-sm font-semibold text-[#9b9ba8] transition hover:bg-[#222228] hover:text-[#ff8fa3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff385c]/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;
