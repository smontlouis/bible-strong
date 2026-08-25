import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Input,
  Stack,
  useRadioGroup,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import Script from 'next/script'
import { useMemo, useState } from 'react'
import Logo from '../../public/images/svg/logo-full.svg'
import { DonationStep } from './DonationStep'
import { RadioButton } from './RadioButton'

type DonationMode = 'one-time' | 'monthly'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
    }
  }
}

const amountsPerDonationMode: Record<DonationMode, string[]> = {
  'one-time': ['10', '20', '50', '100'],
  monthly: ['2', '5', '10', '20'],
}

const webComponentPerAmount: Record<string, React.ReactNode> = {
  '2': (
    <stripe-buy-button
      buy-button-id="buy_btn_1Oh95TFT207ftn8WHBmj2N6F"
      publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY"
    ></stripe-buy-button>
  ),
  '5': (
    <stripe-buy-button
      buy-button-id="buy_btn_1Oh6CBFT207ftn8WJyjBCGFV"
      publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY"
    ></stripe-buy-button>
  ),
  '10': (
    <stripe-buy-button
      buy-button-id="buy_btn_1Oi1LIFT207ftn8W3GZCLTz8"
      publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY"
    ></stripe-buy-button>
  ),
  '20': (
    <stripe-buy-button
      buy-button-id="buy_btn_1Oh6UmFT207ftn8WutQu8ytz"
      publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY"
    ></stripe-buy-button>
  ),
}

export default function GiveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [donationMode, setDonationMode] = useState<DonationMode>('one-time')

  const donationModeRadioGroup = useRadioGroup({
    name: 'donationMode',
    value: donationMode,
    // @ts-expect-error
    onChange: setDonationMode,
  })

  const [amount, setAmount] = useState<string>('10')

  const amountRadioGroup = useRadioGroup({
    name: 'amount',
    value: amount,
    onChange: setAmount,
  })

  const [freeAmount, setFreeAmount] = useState<string>('')

  const donationLink = useMemo(() => {
    if (donationMode === 'one-time') {
      return `https://donate.stripe.com/cN27v9a3y4EZ0SI148?__prefilled_amount=${
        Number(amount || freeAmount || 0) * 100
      }`
    }

    return ``
  }, [donationMode, amount, freeAmount])

  return (
    <Flex flexDirection={{ base: 'column', lg: 'row' }}>
      <Flex flexBasis="50%" bg="#FCFCFC">
        <Flex
          position="sticky"
          top={0}
          pt="1px"
          flex={1}
          alignItems="center"
          justifyContent={{ base: 'center', lg: 'right' }}
          height={{ base: 'auto', lg: '100vh' }}
        >
          <Stack
            gap="10"
            py="10"
            mx={{ base: '10', lg: '20' }}
            maxWidth={380}
            sx={{
              counterReset: 'donation-steps',
            }}
          >
            <NextLink href="/">
              <Box as={Logo} width="240px" height="52px" />
            </NextLink>
            <DonationStep label="Préférez-vous faire un don ponctuel ou mensuel ?">
              <ButtonGroup
                isAttached
                size="md"
                colorScheme="blue"
                variant="outline"
                onChange={(e) => {
                  // @ts-expect-error
                  const value = e.target.value as DonationMode
                  if (value === 'one-time') {
                    setAmount('10')
                  } else {
                    setAmount('2')
                  }
                }}
                {...donationModeRadioGroup.getRootProps()}
              >
                <RadioButton
                  {...donationModeRadioGroup.getRadioProps({
                    value: 'one-time',
                  })}
                  label="Ponctuel"
                />
                <RadioButton
                  {...donationModeRadioGroup.getRadioProps({
                    value: 'monthly',
                  })}
                  label="Mensuel"
                />
              </ButtonGroup>
            </DonationStep>
            <DonationStep label="Choisissez le montant qui vous convient:">
              <Stack direction={{ base: 'column', lg: 'row' }}>
                <ButtonGroup
                  isAttached
                  size="md"
                  colorScheme="blue"
                  variant="outline"
                  onFocus={() => setFreeAmount('')}
                  {...amountRadioGroup.getRootProps()}
                >
                  {amountsPerDonationMode[donationMode].map((amount, i) => (
                    <RadioButton
                      key={amount}
                      {...amountRadioGroup.getRadioProps({ value: amount })}
                      label={`${amount}€`}
                    />
                  ))}
                </ButtonGroup>
                {donationMode === 'one-time' && (
                  <Input
                    colorScheme="blue"
                    size="md"
                    type="number"
                    placeholder="Libre"
                    width="120px"
                    fontWeight="semibold"
                    onFocus={() => setAmount('')}
                    value={freeAmount}
                    onChange={(e) => setFreeAmount(e.target.value)}
                  />
                )}
              </Stack>
            </DonationStep>
            {donationMode === 'one-time' && (
              <Button as="a" colorScheme="blue" size="md" href={donationLink}>
                Contribuer
              </Button>
            )}
            {Boolean(donationMode === 'monthly' && amount) && (
              <Box key={amount} width="288px" height="359px">
                {webComponentPerAmount[amount]}
              </Box>
            )}
          </Stack>
        </Flex>
      </Flex>
      <Stack
        alignItems={{ base: 'center', lg: 'flex-start' }}
        flexBasis="50%"
        boxShadow={{ lg: '15px 0 30px 0 rgba(0,0,0,0.18)' }}
      >
        <Stack
          mx={{ base: '10', lg: '20' }}
          py={{ base: '10', lg: '20' }}
          gap="3"
          maxWidth={380}
        >
          {children}
        </Stack>
      </Stack>
      <Script src="https://js.stripe.com/v3/buy-button.js" />
    </Flex>
  )
}
