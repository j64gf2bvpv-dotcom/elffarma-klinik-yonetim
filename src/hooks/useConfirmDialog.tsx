import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface ConfirmDialogOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'destructive' (kırmızı, "Sil" gibi) ya da 'default' (nötr, "Tamam, Devam Et" gibi) — varsayılan 'destructive'. */
  variant?: 'destructive' | 'default'
}

/**
 * Tarayıcının stilsiz window.confirm()'ü yerine uygulamanın kendi "Vazgeç" /
 * "Sil" diyaloğu (kullanıcı isteğiyle, 2026-08-22 — "bu şekilde menü
 * hiçbir panelde çıkmasın"). Kullanım: `const { confirm, dialog } =
 * useConfirmDialog()`, silme fonksiyonunu async yapıp
 * `if (!(await confirm('... silinsin mi?'))) return` yaz, JSX'in en altına
 * `{dialog}` ekle — confirm() eskisi gibi Promise<boolean> döndürür. İkinci
 * (opsiyonel) parametreyle silme dışı uyarılar için de kullanılabilir (ör.
 * "Tamam, Devam Et" — kullanıcı isteğiyle, 2026-08-23, Günlük Sayım'da dünkü
 * sayımdan az girilince uyarı).
 */
export function useConfirmDialog() {
  const [state, setState] = React.useState<
    ({ message: string; resolve: (value: boolean) => void } & ConfirmDialogOptions) | null
  >(null)

  const confirm = React.useCallback((message: string, options?: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve, ...options })
    })
  }, [])

  function handle(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  const dialog = (
    <Dialog open={!!state} onOpenChange={(next) => !next && handle(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.title ?? 'Emin misiniz?'}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{state?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handle(false)}>
            {state?.cancelLabel ?? 'Vazgeç'}
          </Button>
          <Button
            type="button"
            variant={(state?.variant ?? 'destructive') === 'destructive' ? 'destructive' : 'default'}
            onClick={() => handle(true)}
          >
            {state?.confirmLabel ?? 'Sil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, dialog }
}

// Uygulama genelinde tek "Emin misiniz?" penceresi (2026-11-11, kullanıcı isteği: "silerken
// sorsun emin misiniz diye") — bileşene hook + {dialog} eklemeden tek satırla onay almak için:
// `if (await confirmAction('… silinsin mi?')) remove.mutate(id)`. Host AppShell'de bir kez durur.
let globalConfirm: ((message: string, options?: ConfirmDialogOptions) => Promise<boolean>) | null = null

export function confirmAction(message: string, options?: ConfirmDialogOptions): Promise<boolean> {
  return globalConfirm ? globalConfirm(message, options) : Promise.resolve(window.confirm(message))
}

export function GlobalConfirmHost() {
  const { confirm, dialog } = useConfirmDialog()
  React.useEffect(() => {
    globalConfirm = confirm
    return () => {
      if (globalConfirm === confirm) globalConfirm = null
    }
  }, [confirm])
  return dialog
}
