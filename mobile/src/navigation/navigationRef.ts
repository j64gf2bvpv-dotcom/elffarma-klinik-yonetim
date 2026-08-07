import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootStackParamList } from './types'

// Deep-link handler'ın (bir React bileşeni ağacının DIŞINdan, RootNavigator
// kök seviyesinde) navigasyonu tetikleyebilmesi için — React Navigation'ın
// önerdiği standart desen.
export const navigationRef = createNavigationContainerRef<RootStackParamList>()
