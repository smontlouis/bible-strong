import styled from '@emotion/styled'
import Head from 'next/head'

const TextContainer = styled.div(({ theme }) => ({
  marginTop: 100,
  maxWidth: 500,
  margin: '20px auto',

  h1: {
    margin: '40px 0',
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes['4xl'],
    fontWeight: 'bold',
  },

  h2: {
    margin: '20px 0',
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes['2xl'],
    fontWeight: 'bold',
  },

  hr: {
    margin: '20px 0',
  },

  ul: {
    padding: 20,
  },
}))

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
        <title>Deleting Your Data - Bible Strong App</title>
      </Head>
      <TextContainer>
        <h1>Data deletion</h1>
        <p>
          If you wish to delete your data, please send an email to
          stephane@sevnapps.com with the subject "Data deletion" as well as your
          email address. The data will be erased within 24 hours.
        </p>
      </TextContainer>
    </div>
  )
}
