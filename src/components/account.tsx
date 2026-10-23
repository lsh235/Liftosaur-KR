import { JSX, useEffect, useRef, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Text } from "./primitives/text";
import { Service } from "../api/service";
import { IAccount } from "../models/account";
import { UidFactory_generateUid } from "../utils/generator";
import { getGoogleAccessToken } from "../utils/googleAccessToken";
import { Button } from "./button";
import { Input } from "./input";
import { LinkButton } from "./linkButton";
import { IconApple } from "./icons/iconApple";
import { IconDoc } from "./icons/iconDoc";
import { IconDumbbell } from "./icons/iconDumbbell";
import { IconGoogle } from "./icons/iconGoogle";
import { IconSpinner } from "./icons/iconSpinner";
import { IDispatch } from "../ducks/types";
import { IState } from "../models/state";
import {
  Thunk_googleSignIn,
  Thunk_appleSignIn,
  Thunk_emailAuth,
  Thunk_forgotPassword,
  Thunk_logOut,
} from "../ducks/thunks";
import { IEmailAuthResult } from "../ducks/thunks";
import { track } from "../utils/posthog";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { AppleAuth_init, AppleAuth_signIn } from "../utils/appleAuth";
import { Dialog_alert } from "../utils/dialog";
import { Distribution_isLocalOnly, Distribution_localOnlyMessage } from "../utils/distribution";

interface IAccountProps {
  account?: IAccount;
  redirectUrl?: string;
  dispatch?: IDispatch;
  client: Window["fetch"];
  onSignIn?: (state: IState) => void;
  // App-only: renders a "Sign in with Email" button opening the email-auth modal
  // instead of the inline form. Kept as a callback so this (server-rendered)
  // module never imports react-navigation
  onOpenEmailAuth?: () => void;
}

const isWeb = Platform.OS === "web";

export function Account(props: IAccountProps): JSX.Element {
  if (Distribution_isLocalOnly()) {
    return (
      <View className="px-gutter py-4" testID="local-only-account">
        <Text className="text-lg font-bold text-text-primary">기기에 저장하는 운동 기록</Text>
        <Text className="mt-3 text-base text-text-secondary">{Distribution_localOnlyMessage}</Text>
        <Text className="mt-3 text-sm text-text-secondary">기존 기기의 운동 기록은 유지됩니다. 앱 삭제 전 전체 데이터를 파일로 백업해 주세요.</Text>
      </View>
    );
  }
  const service = new Service(props.client);
  return (
    <View style={{ minWidth: 256, maxWidth: 416, alignSelf: "center", width: "100%" }}>
      {props.account ? (
        <AccountLoggedInView service={service} account={props.account} dispatch={props.dispatch} />
      ) : (
        <AccountLoggedOutView
          service={service}
          redirectUrl={props.redirectUrl}
          dispatch={props.dispatch}
          onSignIn={props.onSignIn}
          onOpenEmailAuth={props.onOpenEmailAuth}
        />
      )}
    </View>
  );
}

const changePasswordErrorMessages: Record<string, string> = {
  invalid_credentials: "현재 비밀번호가 올바르지 않습니다",
  invalid_password: "비밀번호는 8자 이상이어야 합니다",
  password_too_long: "비밀번호는 256자를 넘을 수 없습니다",
  not_authorized: "로그인되어 있지 않습니다",
  network_error: "네트워크 오류입니다. 다시 시도하세요",
};

export function ChangePasswordForm(props: { service: Service; onDone: () => void }): JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);
  const currentRef = useRef("");
  const newRef = useRef("");
  const repeatRef = useRef("");

  async function submit(): Promise<void> {
    setError(undefined);
    if (newRef.current.length < 8) {
      setError(changePasswordErrorMessages.invalid_password);
      return;
    }
    if (newRef.current !== repeatRef.current) {
      setError("새 비밀번호가 서로 일치하지 않습니다");
      return;
    }
    setIsSubmitting(true);
    const err = await props.service.changePassword(currentRef.current || undefined, newRef.current);
    setIsSubmitting(false);
    if (err) {
      setError(changePasswordErrorMessages[err] || "문제가 발생했습니다. 다시 시도하세요");
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <View className="items-center py-4">
        <Text className="text-center text-text-secondary">비밀번호를 변경했습니다.</Text>
        <View className="items-center mt-4">
          <Button name="change-password-done" kind="purple" onClick={() => props.onDone()}>
            완료
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Input
        label="현재 비밀번호"
        identifier="change-password-current"
        type="password"
        changeType="oninput"
        autoCapitalize="none"
        autoCorrect={false}
        changeHandler={(r) => {
          if (r.success) {
            currentRef.current = r.data;
          }
        }}
      />
      <Text className="mt-1 text-xs text-text-secondary">
        Google 또는 Apple로 로그인하며 비밀번호를 설정한 적이 없다면 비워 두세요.
      </Text>
      <View className="mt-3">
        <Input
          label="새 비밀번호"
          identifier="change-password-new"
          type="password"
          changeType="oninput"
          autoCapitalize="none"
          autoCorrect={false}
          changeHandler={(r) => {
            if (r.success) {
              newRef.current = r.data;
            }
          }}
        />
      </View>
      <View className="mt-3">
        <Input
          label="새 비밀번호 확인"
          identifier="change-password-repeat"
          type="password"
          changeType="oninput"
          autoCapitalize="none"
          autoCorrect={false}
          changeHandler={(r) => {
            if (r.success) {
              repeatRef.current = r.data;
            }
          }}
        />
      </View>
      {error && <Text className="mt-2 text-xs text-text-error">{error}</Text>}
      <View className="items-center mt-4">
        <Button
          name="change-password-submit"
          kind="purple"
          testID="change-password-submit"
          data-testid="change-password-submit"
          className="min-w-scaled-32"
          disabled={isSubmitting}
          onClick={() => submit()}
        >
          {isSubmitting ? (
            <IconSpinner width={20} height={20} color={Tailwind_semantic().text.alwayswhite} />
          ) : (
            "비밀번호 변경"
          )}
        </Button>
      </View>
    </View>
  );
}

interface IAccountLoggedInViewProps {
  service: Service;
  account: IAccount;
  dispatch?: IDispatch;
}

function AccountLoggedInView(props: IAccountLoggedInViewProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { account, service } = props;

  if (showChangePassword) {
    return (
      <View>
        <Text className="mb-4 text-lg font-bold text-center">비밀번호 변경</Text>
        <ChangePasswordForm service={service} onDone={() => setShowChangePassword(false)} />
        <View className="items-center mt-4">
          <LinkButton name="change-password-back" className="text-xs" onPress={() => setShowChangePassword(false)}>
            뒤로
          </LinkButton>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text className="mb-4 text-lg font-bold text-center">현재 계정</Text>
      {isLoading ? (
        <View className="items-center my-4">
          <IconSpinner width={48} height={48} />
        </View>
      ) : (
        <>
          <View className="flex-row items-center">
            <Text className="flex-1 mr-2 text-lg">{account.name || `id: ${account.id}`}</Text>
            <View className="flex-row items-center">
              {account.numberOfPrograms != null && (
                <>
                  <Text className="pr-2">{account.numberOfPrograms}</Text>
                  <View className="pr-4">
                    <IconDoc width={12} height={16} />
                  </View>
                </>
              )}
              {account.numberOfWorkouts != null && (
                <>
                  <Text className="pr-2">{account.numberOfWorkouts}</Text>
                  <View>
                    <IconDumbbell width={28} height={19} />
                  </View>
                </>
              )}
            </View>
          </View>
          {account.name && <Text className="text-xs text-text-secondary">id: {account.id}</Text>}
          {account.email !== "noemail@example.com" && (
            <Text className="text-xs text-text-secondary">
              로그인 계정: <Text className="text-xs font-bold text-text-secondary">{account.email}</Text>
            </Text>
          )}
          <View className="items-center mt-4">
            <Button
              name="account-sign-out"
              kind="purple"
              data-testid="menu-item-logout"
              testID="menu-item-logout"
              className="ls-logout"
              onClick={async () => {
                setIsLoading(true);
                if (props.dispatch && !isWeb) {
                  props.dispatch(Thunk_logOut(() => setIsLoading(false)));
                  return;
                }
                await service.signout();
                if (isWeb && typeof window !== "undefined") {
                  window.location.reload();
                } else {
                  setIsLoading(false);
                }
              }}
            >
              Sign Out
            </Button>
            <View className="mt-3">
              <LinkButton
                name="account-change-password"
                className="text-sm"
                onPress={() => setShowChangePassword(true)}
              >
                Change password
              </LinkButton>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

interface IAccountLoggedOutViewProps {
  service: Service;
  redirectUrl?: string;
  dispatch?: IDispatch;
  onSignIn?: (state: IState) => void;
  onOpenEmailAuth?: () => void;
}

function AccountLoggedOutView(props: IAccountLoggedOutViewProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    if (!isWeb) {
      return;
    }
    AppleAuth_init();
  }, []);

  return (
    <View>
      <Text className="mb-4 text-lg font-bold text-center">계정</Text>
      {isLoading ? (
        <View className="items-center my-4">
          <IconSpinner width={48} height={48} />
        </View>
      ) : showEmailForm ? (
        <View>
          <EmailAuthForm service={props.service} redirectUrl={props.redirectUrl} onSignIn={props.onSignIn} />
          <View className="items-center mt-4">
            <LinkButton name="email-auth-back" className="text-xs" onPress={() => setShowEmailForm(false)}>
              로그인 방식 선택으로 돌아가기
            </LinkButton>
          </View>
        </View>
      ) : (
        <View>
          <Pressable
            className="flex-row items-center w-full px-4 py-2 mt-2 rounded-lg nm-sign-in-with-google bg-background-default"
            style={Platform.select({
              ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
              android: { elevation: 2 },
              default: { boxShadow: "0 1px 4px 0 rgba(0,0,0,0.1)" },
            })}
            data-testid="menu-item-login"
            testID="menu-item-login"
            onPress={async () => {
              track({ name: "SignUp" });
              setIsLoading(true);
              if (props.dispatch) {
                props.dispatch(
                  Thunk_googleSignIn((newState) => {
                    setIsLoading(false);
                    props.onSignIn?.(newState);
                  })
                );
                return;
              }
              const accessToken = await getGoogleAccessToken(true);
              if (accessToken != null) {
                const userId = UidFactory_generateUid(8);
                const result = await props.service.googleSignIn(accessToken, userId, {});
                if (result.email) {
                  if (props.redirectUrl && typeof window !== "undefined") {
                    window.location.href = props.redirectUrl;
                  } else if (typeof window !== "undefined") {
                    window.location.reload();
                  }
                } else {
                  setIsLoading(false);
                }
              }
            }}
          >
            <View>
              <IconGoogle />
            </View>
            <Text className="flex-1 ml-2 text-base text-center">Google로 로그인</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center w-full px-4 py-3 mt-2 bg-black rounded-lg nm-sign-in-with-apple"
            onPress={async () => {
              track({ name: "SignUp" });
              setIsLoading(true);
              if (props.dispatch) {
                props.dispatch(
                  Thunk_appleSignIn((newState) => {
                    setIsLoading(false);
                    props.onSignIn?.(newState);
                  })
                );
                return;
              }
              const appleResult = await AppleAuth_signIn();
              if (appleResult.type !== "success") {
                if (appleResult.type === "error") {
                  Dialog_alert(appleResult.error);
                }
                setIsLoading(false);
                return;
              }
              const userId = UidFactory_generateUid(8);
              try {
                const result = await props.service.appleSignIn(appleResult.code, appleResult.id_token, userId);
                if (result.email && typeof window !== "undefined") {
                  window.location.reload();
                } else {
                  setIsLoading(false);
                }
              } catch (e) {
                Dialog_alert("Apple 로그인에 실패했습니다. 다시 시도하세요.");
                setIsLoading(false);
              }
            }}
          >
            <View style={{ marginTop: -3 }}>
              <IconApple />
            </View>
            <Text className="flex-1 ml-2 text-base text-center text-text-alwayswhite">Apple로 로그인</Text>
          </Pressable>
          <EmailAuthButton onPress={props.onOpenEmailAuth || (() => setShowEmailForm(true))} />
        </View>
      )}
    </View>
  );
}

export function EmailAuthButton(props: { onPress: () => void }): JSX.Element {
  return (
    <View className="items-center mt-3">
      <LinkButton name="menu-item-login-email" className="text-xs" onPress={props.onPress}>
        또는 이메일로 로그인
      </LinkButton>
    </View>
  );
}

export type IEmailAuthMode = "signin" | "signup" | "forgot";

const emailAuthErrorMessages: Record<string, string> = {
  invalid_email: "올바른 이메일 주소를 입력하세요",
  invalid_password: "비밀번호는 8자 이상이어야 합니다",
  password_too_long: "비밀번호는 256자를 넘을 수 없습니다",
  account_exists: "이 이메일로 만든 계정이 있습니다. 로그인해 주세요",
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다",
  account_not_found: "이 이메일로 만든 계정을 찾을 수 없습니다",
  wrong_password: "비밀번호가 올바르지 않습니다",
  too_many_attempts: "시도 횟수가 너무 많습니다. 15분 뒤에 다시 시도하세요",
  email_send_failed: "확인 이메일을 보내지 못했습니다. 잠시 후 다시 시도하세요",
  network_error: "네트워크 오류입니다. 다시 시도하세요",
};

interface IEmailAuthFormProps {
  // Required only for the web no-dispatch path; in-app callers pass dispatch and go through thunks
  service?: Service;
  redirectUrl?: string;
  dispatch?: IDispatch;
  onSignIn?: (state: IState) => void;
  onModeChange?: (mode: IEmailAuthMode) => void;
}

export function EmailAuthForm(props: IEmailAuthFormProps): JSX.Element {
  const [mode, setMode] = useState<IEmailAuthMode>("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [info, setInfo] = useState<string | undefined>(undefined);
  const emailRef = useRef("");
  const passwordRef = useRef("");

  function switchMode(newMode: IEmailAuthMode): void {
    setMode(newMode);
    setError(undefined);
    setInfo(undefined);
    props.onModeChange?.(newMode);
  }

  function handleResult(result: IEmailAuthResult): void {
    setIsSubmitting(false);
    if (result.error === "use_oauth") {
      const providers = result.providers?.length ? result.providers : ["Google", "Apple"];
      setError(`이 이메일은 ${providers.join(" 또는 ")} 계정으로 로그인합니다`);
    } else if (result.error) {
      setError(emailAuthErrorMessages[result.error] || "문제가 발생했습니다. 다시 시도하세요");
    } else if (result.confirmationSent) {
      setInfo(
        "이 이메일로 만든 Liftosaur 계정이 있습니다. 비밀번호 설정 링크를 이메일로 보냈습니다. 받은 편지함을 확인하세요."
      );
    }
  }

  async function submit(): Promise<void> {
    const email = emailRef.current.trim();
    const password = passwordRef.current;
    setError(undefined);
    setInfo(undefined);
    if (mode === "forgot") {
      if (!email) {
        setError(emailAuthErrorMessages.invalid_email);
        return;
      }
      setIsSubmitting(true);
      const onSent = (result: IEmailAuthResult): void => {
        if (result.error) {
          handleResult(result);
        } else {
          setIsSubmitting(false);
          setInfo(`${email} 주소로 안내 이메일을 보냈습니다.`);
        }
      };
      if (props.dispatch) {
        props.dispatch(Thunk_forgotPassword(email, onSent));
      } else if (props.service) {
        onSent(await props.service.forgotPassword(email));
      }
      return;
    }
    if (mode === "signup") {
      track({ name: "SignUp" });
    }
    setIsSubmitting(true);
    if (props.dispatch) {
      props.dispatch(
        Thunk_emailAuth(mode, email, password, (result, newState) => {
          handleResult(result);
          if (!result.error && !result.confirmationSent) {
            props.onSignIn?.(newState);
          }
        })
      );
      return;
    }
    if (!props.service) {
      setIsSubmitting(false);
      return;
    }
    const userId = UidFactory_generateUid(8);
    const result =
      mode === "signup"
        ? await props.service.emailSignUp(email, password, userId)
        : await props.service.emailSignIn(email, password, userId);
    if (result.type === "success" && typeof window !== "undefined") {
      if (props.redirectUrl) {
        window.location.href = props.redirectUrl;
      } else {
        window.location.reload();
      }
      return;
    }
    handleResult(
      result.type === "error"
        ? { error: result.error, providers: result.providers }
        : result.type === "confirmation_sent"
          ? { confirmationSent: true }
          : {}
    );
  }

  return (
    <View className="mt-2">
      <Input
        label="이메일"
        identifier="email-auth-email"
        type="email"
        changeType="oninput"
        autoCapitalize="none"
        autoCorrect={false}
        changeHandler={(r) => {
          if (r.success) {
            emailRef.current = r.data;
          }
        }}
      />
      {mode !== "forgot" && (
        <View className="mt-2">
          <Input
            label="비밀번호"
            identifier="email-auth-password"
            type="password"
            changeType="oninput"
            autoCapitalize="none"
            autoCorrect={false}
            changeHandler={(r) => {
              if (r.success) {
                passwordRef.current = r.data;
              }
            }}
          />
        </View>
      )}
      {error && <Text className="mt-2 text-xs text-text-error">{error}</Text>}
      {info && <Text className="mt-2 text-xs text-text-secondary">{info}</Text>}
      <View className="items-center mt-3">
        <Button
          name={`email-auth-${mode}`}
          kind="purple"
          testID="email-auth-submit"
          data-testid="email-auth-submit"
          className="min-w-scaled-32"
          disabled={isSubmitting}
          onClick={() => submit()}
        >
          {isSubmitting ? (
            <IconSpinner width={20} height={20} color={Tailwind_semantic().text.alwayswhite} />
          ) : mode === "signin" ? (
            "로그인"
          ) : mode === "signup" ? (
            "계정 만들기"
          ) : (
            "재설정 링크 보내기"
          )}
        </Button>
      </View>
      <View className="flex-row justify-between mt-4 gap-4">
        {mode !== "signin" && (
          <LinkButton name="email-auth-mode-signin" className="text-sm" onPress={() => switchMode("signin")}>
            로그인
          </LinkButton>
        )}
        {mode !== "signup" && (
          <LinkButton name="email-auth-mode-signup" className="text-sm" onPress={() => switchMode("signup")}>
            계정 만들기
          </LinkButton>
        )}
        {mode !== "forgot" && (
          <LinkButton name="email-auth-mode-forgot" className="text-sm" onPress={() => switchMode("forgot")}>
            비밀번호를 잊으셨나요?
          </LinkButton>
        )}
      </View>
    </View>
  );
}
