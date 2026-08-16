import * as React from 'react'
import { Modal, type ModalProps } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

/**
 * react-native'in native Modal'ı, kök App.tsx'teki SafeAreaProvider'ın
 * ölçtüğü native görünüm hiyerarşisinin DIŞINDA render edilir (iOS'ta ayrı
 * bir pencere) — bu yüzden Modal içindeki Screen/SafeAreaView her zaman
 * sıfır/yanlış üst boşluk alıp başlık çentiğin/durum çubuğunun altında
 * kalıyordu (bkz. react-native-safe-area-context README, "Modal" bölümü).
 * Çözüm kütüphanenin kendi önerdiği yöntem: Modal içine AYRI bir
 * SafeAreaProvider iç içe koymak. Bu bileşen tam olarak Modal'ın yerine
 * geçer (aynı prop'lar) — mevcut tüm `<Modal ...>` kullanımları buna
 * çevrildi, yeni bir Modal eklerken de bunu kullanın.
 */
export function AppModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </Modal>
  )
}
