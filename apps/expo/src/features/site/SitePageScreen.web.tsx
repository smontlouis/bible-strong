import { Redirect } from 'expo-router'

// In a browser a page of the site is read on the site: no link leads here.
const SitePageScreen = () => <Redirect href="/" />

export default SitePageScreen
