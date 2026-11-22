"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ResourceStatus = "loading" | "success" | "error";

/**
 * Carrega um recurso assíncrono com estados de carregamento, sucesso e erro.
 * O retorno `fail` permite demonstrar o estado de erro sem depender de uma
 * falha real; `retry` reinicia o carregamento.
 */
export function useResource<T>(fetcher: () => Promise<T>) {
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [data, setData] = useState<T | null>(null);
  const request = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const id = ++request.current;

    (async () => {
      try {
        const result = await fetcher();
        if (!cancelled && id === request.current) {
          setData(result);
          setStatus("success");
        }
      } catch {
        if (!cancelled && id === request.current) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  const retry = useCallback(() => {
    setStatus("loading");
    const id = ++request.current;
    fetcher()
      .then((result) => {
        if (id === request.current) {
          setData(result);
          setStatus("success");
        }
      })
      .catch(() => {
        if (id === request.current) setStatus("error");
      });
  }, [fetcher]);

  const fail = useCallback(() => setStatus("error"), []);

  return { status, data, retry, fail };
}
