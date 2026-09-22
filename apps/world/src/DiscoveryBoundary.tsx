import { Component, type ReactNode } from 'react'
import { Modal } from './Modal'

type Props = { language: 'fr' | 'en'; onClose: () => void; children: ReactNode }

/** A failed optional chunk must not unmount the exploration world. */
export class DiscoveryBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const french = this.props.language === 'fr'
    return (
      <Modal
        labelledBy="discovery-error"
        closeLabel={french ? 'Fermer' : 'Close'}
        onClose={this.props.onClose}
      >
        <p id="discovery-error" role="alert">
          {french
            ? 'Cette découverte n’a pas pu être chargée. Recharge la page pour réessayer.'
            : 'This discovery could not be loaded. Reload the page to try again.'}
        </p>
      </Modal>
    )
  }
}
