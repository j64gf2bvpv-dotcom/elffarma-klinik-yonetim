import { Volume2, Keyboard, BellRing, Music } from 'lucide-react'

import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSoundSettings } from './useSoundSettings'

/** Ayarlar > Ses Ayarları — herkese açık, tamamen kişisel/cihaza özel bir tercih (localStorage). */
export function SoundSettingsCard() {
  const { settings, update } = useSoundSettings()

  return (
    <CollapsibleCard
      icon={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-black/5">
          <Volume2 className="size-5" />
        </span>
      }
      title="Ses Ayarları"
      description="Bu cihaza özel kişisel bir tercihtir — diğer personelin ekranını etkilemez."
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2.5">
            <Keyboard className="text-muted-foreground size-4" />
            <div>
              <Label htmlFor="sound-keyboard" className="font-normal">
                Klavye Sesleri
              </Label>
              <p className="text-muted-foreground text-xs">Her tuşa basışta kısa bir tık sesi</p>
            </div>
          </div>
          <Checkbox
            id="sound-keyboard"
            checked={settings.keyboard}
            onCheckedChange={(v) => update({ keyboard: v === true })}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2.5">
            <BellRing className="text-muted-foreground size-4" />
            <div>
              <Label htmlFor="sound-notification" className="font-normal">
                Bildirim Sesleri
              </Label>
              <p className="text-muted-foreground text-xs">Yeni bir uyarı/hatırlatma belirdiğinde ses çalar</p>
            </div>
          </div>
          <Checkbox
            id="sound-notification"
            checked={settings.notification}
            onCheckedChange={(v) => update({ notification: v === true })}
          />
        </div>

        <div className="grid gap-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Music className="text-muted-foreground size-4" />
              <div>
                <Label htmlFor="sound-music" className="font-normal">
                  Arka Plan Müziği
                </Label>
                <p className="text-muted-foreground text-xs">
                  public/audio/background.mp3 dosyasını eklerseniz sürekli çalar
                </p>
              </div>
            </div>
            <Checkbox id="sound-music" checked={settings.music} onCheckedChange={(v) => update({ music: v === true })} />
          </div>
          {settings.music && (
            <div className="flex items-center gap-2 pl-6.5">
              <Label className="text-muted-foreground text-xs">Ses Düzeyi</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => update({ musicVolume: Number(e.target.value) })}
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
            </div>
          )}
        </div>
      </div>
    </CollapsibleCard>
  )
}
