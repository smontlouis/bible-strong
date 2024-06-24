import React, { createRef, useEffect } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Sentry from '@sentry/react-native'

import StudyFooter from './StudyFooter';
import { MainStackProps } from '~navigation/type';
import literata from '~assets/fonts/literata';
import i18n from '~i18n';
import studiesHTML from './studiesWebView/studiesHTML';

type Props = {
    isReadOnly: boolean
    onDeltaChangeCallback: any
    fontFamily: string
    contentToDisplay: any
    navigateBibleView: any
    openBibleView: any
    params: RouteProp<MainStackProps>['params']
}

const WebViewQuillEditor = (props: Props) => {
    const webViewRef = createRef<WebView>()
    const navigation = useNavigation<StackNavigationProp<MainStackProps>>()

    const [isKeyboardOpened, setIsKeyboardOpened] = React.useState(false)
    const [activeFormats, setActiveFormat] = React.useState({})

    // listeners
    const updateListener =
        Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow'
    const resetListener =
        Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide'
    const _listeners = [
        Keyboard.addListener(updateListener, () =>
            setIsKeyboardOpened(true)
        ),
        Keyboard.addListener(resetListener, () =>
            setIsKeyboardOpened(false)
        ),
    ]

    useEffect(() => {
        const newParams = props.params || {}

        if (newParams.verse) {
            const isBlock = newParams.block
            dispatchToWebView('FOCUS_EDITOR')
            dispatchToWebView(
                isBlock ? 'GET_BIBLE_VERSES_BLOCK' : 'GET_BIBLE_VERSES',
                newParams
            )
        }
        else {
            const isBlock = newParams.block
            dispatchToWebView('FOCUS_EDITOR')
            dispatchToWebView(
                isBlock ? 'GET_BIBLE_STRONG_BLOCK' : 'GET_BIBLE_STRONG',
                newParams
            )
        }

        if (!props.isReadOnly) {
            dispatchToWebView('CAN_EDIT')
            dispatchToWebView('FOCUS_EDITOR')
        }

        if (props.isReadOnly) {
            dispatchToWebView('READ_ONLY')
            dispatchToWebView('BLUR_EDITOR')
        }
    }, [props.params])

    const dispatchToWebView = (type: string, payload: any) => {
        const webView = webViewRef.current

        if (webView) {
            console.log('RN DISPATCH: ', type)

            webView.injectJavaScript(`
            (function() {
              setTimeout(() => {
                document.dispatchEvent(new CustomEvent("messages", {
                  detail: ${JSON.stringify({ type, payload })}
                }));
              }, 0)
            })()
          `)
        }
    }

    const injectFont = () => {
        const fontRule = `@font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff');}`

        return `
            var style = document.createElement("style");
            style.innerHTML = "${fontRule}";
            document.head.appendChild(style);
            true;
        `
    }

    const setActiveFormats = (formats = '') => {
        setActiveFormat(JSON.parse(formats))
    }

    const handleMessage = (event: WebViewMessageEvent) => {
        // const { navigation } = this.props
        let msgData
        try {
            msgData = JSON.parse(event.nativeEvent.data)
            // console.log('RN RECEIVE: ', msgData.type)

            switch (msgData.type) {
                case 'EDITOR_LOADED':
                    editorLoaded()
                    break
                case 'TEXT_CHANGED':
                    if (props.onDeltaChangeCallback) {
                        delete msgData.payload.type
                        const {
                            delta,
                            deltaChange,
                            deltaOld,
                            changeSource,
                        } = msgData.payload
                        props.onDeltaChangeCallback(
                            delta,
                            deltaChange,
                            deltaOld,
                            changeSource
                        )
                    }
                    break
                case 'VIEW_BIBLE_VERSE': {
                    navigation.navigate('BibleView', {
                        ...msgData.payload,
                        arrayVerses: null, // Remove arrayVerses
                        book: books[msgData.payload.book - 1],
                    })
                    return
                }
                case 'VIEW_BIBLE_STRONG': {
                    navigation.navigate('Strong', msgData.payload)
                    return
                }
                case 'SELECT_BIBLE_VERSE': {
                    navigation.navigate('BibleView', {
                        isSelectionMode: 'verse',
                    })
                    return
                }
                case 'SELECT_BIBLE_STRONG': {
                    navigation.navigate('BibleView', {
                        isSelectionMode: 'strong',
                    })
                    return
                }
                case 'SELECT_BIBLE_VERSE_BLOCK': {
                    navigation.navigate('BibleView', {
                        isSelectionMode: 'verse-block',
                    })
                    return
                }
                case 'SELECT_BIBLE_STRONG_BLOCK': {
                    navigation.navigate('BibleView', {
                        isSelectionMode: 'strong-block',
                    })
                    return
                }
                case 'ACTIVE_FORMATS': {
                    setActiveFormats(msgData.payload)
                    return
                }
                case 'CONSOLE_LOG': {
                    console.log(
                        `%c${msgData.payload}`,
                        'color:black;background-color:#81ecec'
                    )
                    return
                }
                case 'THROW_ERROR': {
                    console.log(
                        `%c${msgData.payload}`,
                        'color:black;background-color:#81ecec'
                    )
                    Alert.alert(
                        `Une erreur est survenue, impossible de charger la page: ${msgData.payload} \n Le développeur en a été informé.`
                    )
                    Sentry.captureMessage(msgData.payload)
                    return
                }

                default:
                    console.warn(
                        `WebViewQuillEditor Error: Unhandled message type received "${msgData.type}"`
                    )
            }
        } catch (err) {
            console.warn(err)
        }

        return undefined // expected type return value
    }

    const onWebViewLoaded = () => {
        const { fontFamily } = props
        dispatchToWebView('LOAD_EDITOR', {
            fontFamily,
            language: i18n.language,
        })
    }

    const editorLoaded = () => {
        if (props.contentToDisplay) {
            dispatchToWebView('SET_CONTENTS', {
                delta: props.contentToDisplay,
            })
        }

        if (!props.isReadOnly) {
            dispatchToWebView('CAN_EDIT')
        }
    }

    // expected error type is event: WebViewErrorEvent
    const onError = (error: string) => {
        Alert.alert('WebView onError', error, [
            { text: 'OK', onPress: () => console.log('OK Pressed') },
        ])

        return undefined // expected type return value
    }

    const renderError = (error: string | undefined, errorCode: number, errorDesc: string) => {
        Alert.alert('WebView renderError', error, [
            { text: 'OK', onPress: () => console.log('OK Pressed') },
        ])

        return undefined // expected type return value
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{
                overflow: 'hidden',
                flex: 1,
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
            }}
        >
            <WebView
                useWebKit
                onLoad={onWebViewLoaded}
                onLoadEnd={injectFont}
                onMessage={handleMessage}
                originWhitelist={['*']}
                ref={webViewRef}
                source={{ html: studiesHTML }}
                injectedJavaScript={injectFont}
                domStorageEnabled
                allowUniversalAccessFromFileURLs
                allowFileAccessFromFileURLs
                allowFileAccess
                keyboardDisplayRequiresUserAction={false}
                renderError={renderError}
                onError={onError}
                bounces={false}
                scrollEnabled={false}
                hideKeyboardAccessoryView
                onContentProcessDidTerminate={syntheticEvent => {
                    console.warn('Content process terminated, reloading...')
                    const { nativeEvent } = syntheticEvent
                    webViewRef.current?.reload()
                    Sentry.captureException(nativeEvent)
                }}
                onRenderProcessGone={syntheticEvent => {
                    webViewRef.current?.reload()
                    const { nativeEvent } = syntheticEvent
                    Sentry.captureException(nativeEvent)
                }}
            />
            {isKeyboardOpened && (
                <StudyFooter
                    navigateBibleView={props.navigateBibleView}
                    openBibleView={props.openBibleView}
                    dispatchToWebView={dispatchToWebView}
                    activeFormats={activeFormats}
                />
            )}
        </KeyboardAvoidingView>
    )
}

export default WebViewQuillEditor;
