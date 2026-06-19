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
  useTodosLivros,
  useCreateBook,
  useUpdateBook,
  useDeleteBook,
  useAddBookToShelf,
  useRemoveBookFromShelf,
} from "./books";

export {
  useChapter,
  useChapterConteudo,
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
} from "./chapters";

export {
  usePage,
  usePageRevisions,
  useRevision,
  useRestaurarRevisao,
  useCreatePage,
  useUpdatePage,
  useMovePage,
  useDeletePage,
} from "./pages";

export { useBusca } from "./search";

export {
  useTeams,
  useTeamMembers,
  useCreateTeam,
  useAddMember,
  useRemoveMember,
  useDeleteTeam,
} from "./teams";

export {
  ensureProfile,
  useEnsureProfile,
  useProfile,
} from "./profile";

export { useAtividadeRecente, useAtividadeDoLivro } from "./activities";

export {
  registrarView,
  useVistosRecentemente,
  usePopularBooks,
} from "./views";

export {
  useMeusFavoritos,
  useIsFavorito,
  useToggleFavorito,
} from "./favorites";

export { useMeusRascunhos, usePaginasAtualizadas } from "./drafts";
