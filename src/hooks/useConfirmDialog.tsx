import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Tarayıcının stilsiz window.confirm()'ü yerine uygulamanın kendi "Vazgeç" /
 * "Sil" diyaloğu (kullanıcı isteğiyle, 2026-08-22 — "bu şekilde menü
 * hiçbir panelde çıkmasın"). Kullanım: `const { confirm, dialog } =
 * useConfirmDialog()`, silme fonksiyonunu async yapıp
 * `if (!(await confirm('... silinsin mi?'))) return` yaz, JSX'in en altına
 * `{dialog}` ekle — confirm() eskisi gibi Promise<boolean> döndürür.
 */
export function useConfirmDialog() {
  const [state, setState] = React.useState<{ message: string; resolve: (value: boolean) => void } | null>(null)

  const confirm = React.useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve })
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
          <DialogTitle>Emin misiniz?</DialogTitle>
          <DialogDescription>{state?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handle(false)}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" onClick={() => handle(true)}>
            Sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, dialog }
}
