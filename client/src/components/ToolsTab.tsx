import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import DynamicJsonForm from "./DynamicJsonForm";
import type { JsonValue, JsonSchemaType } from "@/utils/jsonUtils";
import { generateDefaultValue } from "@/utils/schemaUtils";
import {
  CallToolResultSchema,
  CompatibilityCallToolResult,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import ListPane from "./ListPane";
import JsonView from "./JsonView";

// 递归渲染参数表单的组件
const ParameterForm = ({
  schema,
  path = [],
  value,
  onChange,
}: {
  schema: JsonSchemaType;
  path: string[];
  value: any;
  onChange: (newValue: any) => void;
}) => {
  const handleChange = (newValue: any) => {
    onChange(newValue);
  };

  const paramKey = path[path.length - 1] || "";
  const displayName = path.join(".");

  if (schema.type === "boolean") {
    return (
      <div className="flex items-center space-x-2 mt-2">
        <Checkbox
          id={displayName}
          name={displayName}
          checked={!!value}
          onCheckedChange={(checked: boolean) => handleChange(checked)}
        />
        <label
          htmlFor={displayName}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {schema.description || `Toggle ${paramKey}`}
        </label>
      </div>
    );
  } else if (schema.type === "string") {
    return (
      <Textarea
        id={displayName}
        name={displayName}
        placeholder={schema.description}
        value={value ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="mt-1"
      />
    );
  } else if (schema.type === "number" || schema.type === "integer") {
    return (
      <Input
        type="number"
        id={displayName}
        name={displayName}
        placeholder={schema.description}
        value={value ?? ""}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="mt-1"
      />
    );
  } else if (schema.type === "object" && schema.properties) {
    return (
      <div className="mt-1 space-y-4 border border-gray-200 dark:border-gray-700 rounded-md p-3">
        <h4 className="text-sm font-medium">
          {schema.description || paramKey}
        </h4>
        {Object.entries(schema.properties).map(([key, propSchema]) => {
          const newPath = [...path, key];
          const propValue =
            value?.[key] ?? generateDefaultValue(propSchema as JsonSchemaType);

          return (
            <div key={key} className="ml-2">
              <Label
                htmlFor={newPath.join(".")}
                className="block text-sm font-medium text-gray-700"
              >
                {key}
              </Label>
              <ParameterForm
                schema={propSchema as JsonSchemaType}
                path={newPath}
                value={propValue}
                onChange={(newPropValue) => {
                  const newValue = { ...(value || {}) };
                  newValue[key] = newPropValue;
                  handleChange(newValue);
                }}
              />
            </div>
          );
        })}
      </div>
    );
  } else if (schema.type === "array" && schema.items) {
    return (
      <div className="mt-1">
        <DynamicJsonForm
          schema={{
            type: schema.type,
            items: schema.items,
            description: schema.description,
          }}
          value={value ?? []}
          onChange={(newValue: JsonValue) => handleChange(newValue)}
        />
      </div>
    );
  } else {
    // 对于其他类型或复杂情况，使用DynamicJsonForm
    return (
      <div className="mt-1">
        <DynamicJsonForm
          schema={schema}
          value={value}
          onChange={(newValue: JsonValue) => handleChange(newValue)}
        />
      </div>
    );
  }
};

const ToolsTab = ({
  tools,
  listTools,
  clearTools,
  callTool,
  selectedTool,
  setSelectedTool,
  toolResult,
  nextCursor,
}: {
  tools: Tool[];
  listTools: () => void;
  clearTools: () => void;
  callTool: (name: string, params: Record<string, unknown>) => Promise<void>;
  selectedTool: Tool | null;
  setSelectedTool: (tool: Tool | null) => void;
  toolResult: CompatibilityCallToolResult | null;
  nextCursor: ListToolsResult["nextCursor"];
  error: string | null;
}) => {
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [isToolRunning, setIsToolRunning] = useState(false);

  useEffect(() => {
    const params = Object.entries(
      selectedTool?.inputSchema.properties ?? [],
    ).map(([key, value]) => [
      key,
      generateDefaultValue(value as JsonSchemaType),
    ]);
    setParams(Object.fromEntries(params));
  }, [selectedTool]);

  const renderToolResult = () => {
    if (!toolResult) return null;

    if ("content" in toolResult) {
      const parsedResult = CallToolResultSchema.safeParse(toolResult);
      if (!parsedResult.success) {
        return (
          <>
            <h4 className="font-semibold mb-2">Invalid Tool Result:</h4>
            <JsonView data={toolResult} />
            <h4 className="font-semibold mb-2">Errors:</h4>
            {parsedResult.error.errors.map((error, idx) => (
              <JsonView data={error} key={idx} />
            ))}
          </>
        );
      }
      const structuredResult = parsedResult.data;
      const isError = structuredResult.isError ?? false;

      return (
        <>
          <h4 className="font-semibold mb-2">
            Tool Result:{" "}
            {isError ? (
              <span className="text-red-600 font-semibold">Error</span>
            ) : (
              <span className="text-green-600 font-semibold">Success</span>
            )}
          </h4>
          {structuredResult.content.map((item, index) => (
            <div key={index} className="mb-2">
              {item.type === "text" && (
                <JsonView data={item.text} isError={isError} />
              )}
              {item.type === "image" && (
                <img
                  src={`data:${item.mimeType};base64,${item.data}`}
                  alt="Tool result image"
                  className="max-w-full h-auto"
                />
              )}
              {item.type === "resource" &&
                (item.resource?.mimeType?.startsWith("audio/") ? (
                  <audio
                    controls
                    src={`data:${item.resource.mimeType};base64,${item.resource.blob}`}
                    className="w-full"
                  >
                    <p>Your browser does not support audio playback</p>
                  </audio>
                ) : (
                  <JsonView data={item.resource} />
                ))}
            </div>
          ))}
        </>
      );
    } else if ("toolResult" in toolResult) {
      return (
        <>
          <h4 className="font-semibold mb-2">Tool Result (Legacy):</h4>

          <JsonView data={toolResult.toolResult} />
        </>
      );
    }
  };

  return (
    <TabsContent value="tools">
      <div className="grid grid-cols-2 gap-4">
        <ListPane
          items={tools}
          listItems={listTools}
          clearItems={() => {
            clearTools();
            setSelectedTool(null);
          }}
          setSelectedItem={setSelectedTool}
          renderItem={(tool) => (
            <>
              <span className="flex-1">{tool.name}</span>
              <span className="text-sm text-gray-500 text-right">
                {tool.description}
              </span>
            </>
          )}
          title="Tools"
          buttonText={nextCursor ? "List More Tools" : "List Tools"}
          isButtonDisabled={!nextCursor && tools.length > 0}
        />

        <div className="bg-card rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold">
              {selectedTool ? selectedTool.name : "Select a tool"}
            </h3>
          </div>
          <div className="p-4">
            {selectedTool ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {selectedTool.description}
                </p>
                {Object.entries(selectedTool.inputSchema.properties ?? []).map(
                  ([key, value]) => {
                    const prop = value as JsonSchemaType;
                    return (
                      <div key={key}>
                        <Label
                          htmlFor={key}
                          className="block text-sm font-medium text-gray-700"
                        >
                          {key}
                        </Label>
                        <ParameterForm
                          schema={prop}
                          path={[key]}
                          value={params[key]}
                          onChange={(newValue) => {
                            setParams({
                              ...params,
                              [key]: newValue,
                            });
                          }}
                        />
                      </div>
                    );
                  },
                )}
                <Button
                  onClick={async () => {
                    try {
                      setIsToolRunning(true);
                      await callTool(selectedTool.name, params);
                    } finally {
                      setIsToolRunning(false);
                    }
                  }}
                  disabled={isToolRunning}
                >
                  {isToolRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Run Tool
                    </>
                  )}
                </Button>
                {toolResult && renderToolResult()}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Select a tool from the list to view its details and run it
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </TabsContent>
  );
};

export default ToolsTab;
