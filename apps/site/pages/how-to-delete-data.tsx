import { LegalTextContainer as TextContainer, PageMetadata as Head } from '../common/LegalPage'

export default function Page() {
  return (
    <div
      style={{
        backgroundImage: `url(/images/background.jpg)`,
        backgroundSize: 'contain',
        backgroundPosition: 'right',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        marginBottom: '50px',
        padding: '0 20px',
      }}
    >
      <Head>
        <title>How to delete data ? </title>
      </Head>
      <TextContainer>
        <h1>How to delete data ? </h1>
        <p>
          If you want to delete your data, please go to Bible Strong App, in the
          "More" menu and click on "delete my account" at the bottom of the
          page.
        </p>
      </TextContainer>
    </div>
  )
}
