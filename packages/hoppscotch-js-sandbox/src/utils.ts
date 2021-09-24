import { Either, left, right } from "fp-ts/lib/Either";
import * as QuickJS from "quickjs-emscripten";

export function marshalObjectToVM(vm: QuickJS.QuickJSVm, obj: object): Either<string, QuickJS.QuickJSHandle> {
  let jsonString

  try {
    jsonString = JSON.stringify(obj)
  } catch (e) {
    return left("Marshaling stringification failed")
  }

  const vmStringHandle = vm.newString(jsonString)

  const jsonHandle = vm.getProp(vm.global, "JSON")
  const parseFuncHandle = vm.getProp(jsonHandle, "parse")

  const parseResultHandle = vm.callFunction(parseFuncHandle, vm.undefined, vmStringHandle)

  if (parseResultHandle.error) {
    parseResultHandle.error.dispose()
    return left("Marshaling failed")
  }

  const resultHandle = vm.unwrapResult(parseResultHandle)

  vmStringHandle.dispose()
  parseFuncHandle.dispose()
  jsonHandle.dispose()
  
  return right(resultHandle)
}