"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { api } from "@/lib/api/client";
import { useOffice } from "@/lib/store/office-store";

/** Order tickets to Telegram: semi-automatic trading, the CEO places orders by hand. */
export function TelegramSettings() {
  const configured = useOffice((s) => s.provider.status?.telegram.enabled ?? false);
  const enabled = useOffice((s) => s.settings.telegram ?? true);
  const update = useOffice((s) => s.updateSettings);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const test = async () => {
    setSending(true);
    setResult(null);
    try {
      await api.telegram({ type: "test" });
      setResult("Pesan tes terkirim. Cek Telegram Anda.");
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Notifikasi Telegram"
        subtitle="Setup BUY baru dari autopilot dikirim sebagai order ticket (entry, SL, TP, jumlah lot). Order tetap Anda pasang sendiri di aplikasi broker."
      />
      <div className="space-y-4 p-4">
        {configured ? (
          <div className="flex flex-wrap items-end gap-4">
            <Segmented
              label="Kirim order ticket"
              value={enabled ? "on" : "off"}
              onChange={(v) => update({ telegram: v === "on" })}
              options={[
                { value: "on", label: "Aktif" },
                { value: "off", label: "Nonaktif" },
              ]}
            />
            <Button size="sm" onClick={test} disabled={sending}>
              <Send className="size-3.5" /> Kirim pesan tes
            </Button>
          </div>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
            <li>
              Buka <b className="text-fg">@BotFather</b> di Telegram, kirim <code>/newbot</code>, lalu salin token bot.
            </li>
            <li>Kirim pesan apa saja ke bot baru Anda.</li>
            <li>
              Buka <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> dan salin angka <code>chat.id</code>.
            </li>
            <li>
              Isi <code>TELEGRAM_BOT_TOKEN</code> dan <code>TELEGRAM_CHAT_ID</code> di <code>.env.local</code>, lalu restart <code>npm run dev</code>.
            </li>
          </ol>
        )}
        {result && (
          <p role="status" className="rounded-lg bg-panel-2 px-3 py-2 text-xs text-fg">
            {result}
          </p>
        )}
        <p className="text-xs text-subtle">
          Pasang TP dan SL lewat fitur Stop Loss / Take Profit di aplikasi broker, supaya tetap berjalan walaupun aplikasi ini ditutup.
        </p>
      </div>
    </Panel>
  );
}
