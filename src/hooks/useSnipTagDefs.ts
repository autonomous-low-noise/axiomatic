import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface SnipTagDef {
  name: string
  color: string
}

export function useSnipTagDefs(dirPaths: string[]) {
  const [defs, setDefs] = useState<SnipTagDef[]>([])

  const refresh = useCallback(async () => {
    if (dirPaths.length === 0) {
      setDefs([])
      return
    }
    // Load from first directory (all dirs kept in sync by fan-out)
    try {
      const result = await invoke<SnipTagDef[]>('list_snip_tag_defs', { dirPath: dirPaths[0] })
      setDefs(result)
    } catch (err) {
      console.error('list_snip_tag_defs failed:', err)
    }
  }, [dirPaths])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: fetch on mount
    refresh()
  }, [refresh])

  const createDef = useCallback(async (name: string, color: string) => {
    await invoke('create_snip_tag_def', { dirPaths, name, color })
    await refresh()
  }, [dirPaths, refresh])

  const deleteDef = useCallback(async (name: string) => {
    await invoke('delete_snip_tag_def', { dirPaths, name })
    await refresh()
  }, [dirPaths, refresh])

  const renameDef = useCallback(async (oldName: string, newName: string) => {
    await invoke('rename_snip_tag_def', { dirPaths, oldName, newName })
    await refresh()
  }, [dirPaths, refresh])

  const recolorDef = useCallback(async (name: string, color: string) => {
    await invoke('recolor_snip_tag_def', { dirPaths, name, color })
    await refresh()
  }, [dirPaths, refresh])

  return { defs, createDef, deleteDef, renameDef, recolorDef, refresh }
}
