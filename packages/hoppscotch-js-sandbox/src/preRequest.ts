import { pipe } from "fp-ts/lib/function";
import { chain, TaskEither, tryCatch, right, left } from "fp-ts/lib/TaskEither";
import * as qjs from "quickjs-emscripten";
import clone from "lodash/clone";

type EnvEntry = {
  key: string;
  value: string;
};

export const execPreRequestScript = (
  preRequestScript: string,
  env: EnvEntry[]
): TaskEither<string, EnvEntry[]> => pipe(
  tryCatch(
    async () => await qjs.getQuickJS(),
    (reason) => `QuickJS initialization failed: ${reason}`
  ),
  chain(
    (QuickJS) => {
      const finalEnv = clone(env)

      const vm = QuickJS.createVm()

      const pwHandle = vm.newObject()

      const envHandle = vm.newObject()

      const envSetFuncHandle = vm.newFunction("set", (keyHandle, valueHandle) => {
        const key = vm.dump(keyHandle)
        const value = vm.dump(valueHandle)

        if (typeof key !== "string") return {
          error: vm.newString("Expected key to be a string") 
        }

        if (typeof value !== "string") return {
          error: vm.newString("Expected value to be a string")
        }

        const keyIndex = finalEnv.findIndex((env) => env.key === key)

        if (keyIndex === -1) {
          finalEnv.push({ key, value })
        } else {
          finalEnv[keyIndex] = { key, value }
        }

        return {
          value: vm.undefined
        }
      })

      vm.setProp(envHandle, "set", envSetFuncHandle)
      envSetFuncHandle.dispose()

      vm.setProp(pwHandle, "env", envHandle)
      envHandle.dispose()

      vm.setProp(vm.global, "pw", pwHandle)
      pwHandle.dispose()

      const evalRes = vm.evalCode(preRequestScript)

      if (evalRes.error) {
        const errorData = vm.dump(evalRes.error)
        evalRes.error.dispose()

        return left(`Script evaluation failed: ${errorData}`)
      }

      vm.dispose()

      return right(finalEnv)
    }
  )
)