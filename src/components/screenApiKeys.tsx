import { JSX, useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { useNavOptions } from "../navigation/useNavOptions";
import { GroupHeader } from "./groupHeader";
import { Button } from "./button";
import { Input } from "./input";
import { INavCommon } from "../models/state";
import { Service } from "../api/service";
import { ClipboardUtils_copy } from "../utils/clipboard";
import { ISubscription } from "../types";
import { Subscriptions_hasSubscription } from "../utils/subscriptions";
import { Thunk_pushScreen } from "../ducks/thunks";
import { IconSpinner } from "./icons/iconSpinner";
import { Dialog_confirm } from "../utils/dialog";

interface IApiKey {
  key: string;
  name: string;
  createdAt: number;
}

interface IProps {
  dispatch: IDispatch;
  navCommon: INavCommon;
  service: Service;
  subscription: ISubscription;
  userId?: string;
}

export function ScreenApiKeys(props: IProps): JSX.Element {
  const [keys, setKeys] = useState<IApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const newKeyNameRef = useRef("");
  const [copiedKey, setCopiedKey] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const isLoggedIn = props.userId != null;
  const isSubscribed = Subscriptions_hasSubscription(props.subscription);

  useEffect(() => {
    if (isSubscribed) {
      props.service.getApiKeys().then((result) => {
        setKeys(result);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleCreate = async (): Promise<void> => {
    const name = newKeyNameRef.current.trim() || "API Key";
    setIsCreating(true);
    setCreateError(undefined);
    const result = await props.service.createApiKey(name);
    setIsCreating(false);
    if (result) {
      setKeys([...keys, result]);
      newKeyNameRef.current = "";
    } else {
      setCreateError("Failed to create API key. Please try again.");
    }
  };

  const handleDelete = async (key: string): Promise<void> => {
    if (!(await Dialog_confirm("Are you sure you want to delete this API key?"))) {
      return;
    }
    const success = await props.service.deleteApiKey(key);
    if (success) {
      setKeys(keys.filter((k) => k.key !== key));
    }
  };

  const handleCopy = (key: string): void => {
    ClipboardUtils_copy(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(undefined), 2000);
  };

  useNavOptions({ navTitle: "API 키" });

  return (
    <View className="px-gutter">
      {!isLoggedIn ? (
        <View className="py-8">
          <Text className="mb-4 text-center text-text-secondary">
            API 키를 사용하면 Liftosaur를 외부 도구, LLM, MCP 서버와 연동할 수 있습니다. 운동 기록과 프로그램을 조회·수정하고
            플레이그라운드 API로 운동을 시뮬레이션할 수 있습니다.
          </Text>
          <Text className="text-center text-text-secondary">API 키를 관리하려면 먼저 로그인하세요.</Text>
          <View className="items-center mt-4">
            <Button kind="purple" name="login-for-api" onClick={() => props.dispatch(Thunk_pushScreen("account"))}>
              로그인
            </Button>
          </View>
        </View>
      ) : !isSubscribed ? (
        <View className="py-8">
          <Text className="mb-4 text-center text-text-secondary">
            API 키를 사용하면 Liftosaur를 외부 도구, LLM, MCP 서버와 연동할 수 있습니다. 운동 기록과 프로그램을 조회·수정하고
            플레이그라운드 API로 운동을 시뮬레이션할 수 있습니다.
          </Text>
          <View className="items-center">
            <Button
              kind="purple"
              name="subscribe-for-api"
              onClick={() => props.dispatch(Thunk_pushScreen("subscription"))}
            >
              구독하고 잠금 해제
            </Button>
          </View>
        </View>
      ) : (
        <>
          <GroupHeader name="새 키 만들기" />
          <View className="flex-row items-center gap-2 pb-2">
            <View className="flex-1">
              <Input
                type="text"
                inputSize="sm"
                placeholder="키 이름"
                changeHandler={(result) => {
                  if (result.success) {
                    newKeyNameRef.current = result.data;
                  }
                }}
              />
            </View>
            <Button kind="purple" buttonSize="lg" name="create-api-key" disabled={isCreating} onClick={handleCreate}>
              {isCreating ? (
                <IconSpinner color="white" width={18} height={18} />
              ) : (
                <Text className="text-text-alwayswhite font-semibold">만들기</Text>
              )}
            </Button>
          </View>
          {createError && <Text className="pb-2 text-xs text-text-error">{createError}</Text>}

          <GroupHeader name="내 API 키" topPadding={true} />
          {isLoading ? (
            <View className="items-center py-4">
              <IconSpinner width={40} height={40} />
            </View>
          ) : keys.length === 0 ? (
            <Text className="py-4 text-center text-text-secondary">아직 API 키가 없습니다</Text>
          ) : (
            keys.map((apiKey) => (
              <View key={apiKey.key} className="py-2 border-b border-border-neutral">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 min-w-0">
                    <Text className="font-bold">{apiKey.name}</Text>
                    <Text className="text-xs text-text-secondary">{apiKey.key}</Text>
                    <Text className="text-xs text-text-secondary">
                      생성일 {new Date(apiKey.createdAt).toLocaleDateString("ko-KR")}
                    </Text>
                  </View>
                  <View className="flex-row gap-4 ml-2 shrink-0">
                    <Pressable testID="copy-api-key" data-testid="copy-api-key" onPress={() => handleCopy(apiKey.key)}>
                      <Text className="text-xs underline text-text-link">
                        {copiedKey === apiKey.key ? "복사 완료" : "복사"}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID="delete-api-key"
                      data-testid="delete-api-key"
                      onPress={() => handleDelete(apiKey.key)}
                    >
                      <Text className="text-xs underline text-text-error">삭제</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}
