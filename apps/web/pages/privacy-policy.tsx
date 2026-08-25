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
        <title>Privacy Policy - Bible Strong App</title>
      </Head>
      <TextContainer>
        <h1>Model privacy policy.</h1>
        <p>
          <strong>Introduction</strong>
          <br />
          Faced with the development of new communication tools, it is necessary
          to pay special attention to the protection of privacy. Therefore,
          Bible Strong App is committed to; respect confidentiality of the
          personal information collected. Bible Strong App is a application
          developed by Stéphane Montlouis-Calixte.
        </p>
        <hr />
        <h2>Collection of personal information</h2>
        <p>Bible Strong App collects the following information:</p>
        <ul>
          <li>Name</li>
          <li>First name</li>
          <li>E-mail address</li>
        </ul>

        <p>
          The personal information that Bible Strong App collects is collected
          through forms and thanks to; interactivity established between you and
          our application. Bible Strong App also uses, as noted; in the
          following section, cookie files and/or logs for collect information
          about you.
        </p>
        <hr />
        <h2>Forms&nbsp; and interactivity:</h2>
        <p>Your personal information is collected through form, to know :</p>
        <ul>
          <li>App registration form</li>
        </ul>
        <p>
          Bible Strong App uses the information so collected for the following
          purposes:
        </p>
        <ul>
          <li>Statistics</li>
          <li>Application management (presentation, organization)</li>
        </ul>
        <p>
          Your information is also collected through interactivity that can be
          established between you and our application as follows:
        </p>
        <ul></ul>
        <p>
          Bible Strong App uses the information so collected for the following
          purposes:
          <br />
        </p>
        <ul></ul>
        <hr />
        <h2>Log files and cookies</h2>
        <p>
          Bible Strong App collects certain information through log files (log
          file) and witness files (cookies). This mainly concerns the following
          information:
        </p>
        <ul>
          <li>IP address</li>
          <li>Operating System</li>
          <li>Pages visited and queries</li>
          <li>Connection time and day</li>
        </ul>

        <br />
        <p>The use of such files allows us:</p>
        <ul>
          <li>Improved service and personalized welcome</li>
          <li>Statistics</li>
        </ul>
        <hr />
        <h2>Right of opposition and withdrawal</h2>
        <p>
          Bible Strong App is committed to; offer you a right of opposition and
          withdrawal as to your personal information.
          <br />
          The right of opposition is understood as being the possibility;
          offered to Internet users to refuse that their personal information
          are used to certain purposes mentioned during collection.
          <br />
        </p>
        <p>
          The right of withdrawal is understood as being the possibility offered
          to Internet users to ask &agrave; what their personal information no
          longer appears, for example, in a broadcast list.
          <br />
        </p>
        <p>
          To be able to exercise these rights, you can: <br />
          Postcode: 105, hillcrest road, raumati beach 5032
          <br /> Email: s.montlouis.calixte@gmail.com
          <br /> Telephone: 0272539320
          <br />{' '}
        </p>
        <hr />
        <h2>Access rights</h2>
        <p>
          Bible Strong App is committed to; recognize a right of access and
          rectification to the persons concerned wishing to consult, modify or
          even cancel the information about them.
          <br />
          The exercise of this right will be:
          <br />
          Postcode: 105, hillcrest road, raumati beach 5032
          <br /> Email: s.montlouis.calixte@gmail.com
          <br /> Telephone: 0272539320
          <br />{' '}
        </p>
        <hr />
        <h2>Security</h2>
        <p>
          The personal information that Bible Strong App collects is stored in a
          secure environment. The people working for Bible Strong App are
          required to respect confidentiality of your information.
          <br />
          To ensure safety of your information personal information, Bible
          Strong App uses the following measures:
        </p>
        <ul>
          <li>Access management - authorized person</li>
          <li>Access management - data subject</li>
          <li>Computer backup</li>
          <li>Username / password</li>
        </ul>

        <p>
          Bible Strong App is committed to; maintain a high degree of
          confidentiality by integrating the latest technological innovations to
          ensure the confidentiality of your transactions. However, like no
          mechanism does not provide security; maximum, one share risk is always
          present when using the Internet to transmit personal information.
        </p>
      </TextContainer>
    </div>
  )
}
