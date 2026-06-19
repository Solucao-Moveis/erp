// ============================================================
// Camada de dados do Caderno — ponto único de importação.
// import { useShelves, useBookConteudo, qk, slugify } from "@/data";
// ============================================================

export { qk } from "./keys";
export { slugify, slugUnico, sufixoAleatorio } from "./slug";
export { getUserId } from "./auth";

export {
  useShelves,
  useShelf,
  useCreateShelf,
  useUpdateShelf,
  useDeleteShelf,
} from "./shelves";

export {
  useBook,
  useBookConteudo,
  useCreateBook,
  useUpdateBook,
  useDeleteBook,
  useAddBookToShelf,
  useRemoveBookFromShelf,
} from "./books";

export {
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
} from "./chapters";

export {
  usePage,
  usePageRevisions,
  useCreatePage,
  useUpdatePage,
  useMovePage,
  useDeletePage,
} from "./pages";

export { useBusca } from "./search";
export { useTeams } from "./teams";
export {
  ensureProfile,
  useEnsureProfile,
  useProfile,
} from "./profile";
