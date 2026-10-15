/** Scroll limits shared by the dialogue card and its pointer controls. */
export const getCaptionScrollBounds = (list: HTMLDivElement) => {
  const assistantMessages = list.querySelectorAll<HTMLElement>(".agent-chat__message--assistant");
  if (assistantMessages.length === 0) return { minimum: 0, maximum: 0 };
  if (assistantMessages.length === 1) return { minimum: 0, maximum: 0 };
  const latest = assistantMessages.item(assistantMessages.length - 1);
  const scrollRoom = list.querySelector<HTMLElement>(".agent-chat__scroll-room");
  const lastVisibleItem = scrollRoom?.previousElementSibling instanceof HTMLElement
    ? scrollRoom.previousElementSibling
    : latest;
  const viewportFit = Math.max(0, lastVisibleItem.offsetTop + lastVisibleItem.offsetHeight - list.clientHeight + 16);
  const previousHalf = assistantMessages.length > 1
    ? assistantMessages.item(assistantMessages.length - 2).offsetTop
      + assistantMessages.item(assistantMessages.length - 2).offsetHeight / 2
    : 0;
  const maximum = Math.max(viewportFit, previousHalf);
  return { minimum: 0, maximum };
};
