// Serialises card requests so a late refresh cannot overwrite an open/close.
export function createCardController({
  request,
  onChange,
  onMessage,
  onPending,
}) {
  let pending = false;
  async function run(action, silent = false) {
    if (pending) return { skipped: true };
    pending = true;
    onPending(true);
    try {
      return await action();
    } catch (error) {
      if (error.status === 401) onChange(null);
      if (!silent) onMessage(error.message);
      return { success: false };
    } finally {
      pending = false;
      onPending(false);
    }
  }
  return {
    get pending() {
      return pending;
    },
    open(phone, consent) {
      return run(async () => {
        onMessage("กำลังเปิดบัตรสะสม");
        const card = await request("card", { phone, consent });
        onChange(card);
        onMessage("เปิดบัตรสะสมเรียบร้อยแล้ว");
        return { success: true };
      });
    },
    refresh(silent = false) {
      return run(async () => {
        const card = await request("card");
        onChange(card);
        if (!silent) onMessage("ปรับปรุงยอดสะสมเรียบร้อยแล้ว");
        return { success: true };
      }, silent);
    },
    close() {
      return run(async () => {
        await request("card/close", {});
        onChange(null);
        onMessage(
          "ปิดบัตรบนอุปกรณ์นี้แล้ว ยอดสะสมยังคงอยู่สำหรับเรียกดูด้วยหมายเลขเดิม",
        );
        return { success: true };
      });
    },
  };
}
