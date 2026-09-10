import * as Icons from '@expo/vector-icons'
import { withUniwind } from 'uniwind'

// Map className to the icon's style slot, after its internal size/color defaults.
// The standard web adapter forwards CSS classes without resolving CSS in JavaScript.
export const Feather = Object.assign(withUniwind(Icons.Feather), Icons.Feather)
export const Ionicons = Object.assign(withUniwind(Icons.Ionicons), Icons.Ionicons)
export const MaterialIcons = Object.assign(withUniwind(Icons.MaterialIcons), Icons.MaterialIcons)
export const FontAwesome = Object.assign(withUniwind(Icons.FontAwesome), Icons.FontAwesome)
