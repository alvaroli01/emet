"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners,
  useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Calendar, CheckSquare, MessageSquare, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar, ViewOnlyBadge } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { BoardCard, BoardData, ListRow, Member } from "@/lib/boards";
import { CardDialog } from "./card-dialog";
import { LabelChip, useListName } from "./labels";
import { TrelloPanel } from "./trello-panel";
import { TemplateMenu } from "./templates";
import { pushToTrello } from "./trello-push";


export type Viewer = { meId: string; isAdmin: boolean; myGroupId: string | null };

export function boardRights(board: BoardData["board"], v: Viewer) {
  const general = board.group_id === null;
  const groupEdit = v.isAdmin || (!!board.group_id && board.group_id === v.myGroupId);
  return {
    general,
    canEditLists: general ? v.isAdmin : groupEdit,
    canAdd: general ? true : groupEdit,
    canEditCard: (c: Pick<BoardCard, "created_by" | "assignees">) =>
      general ? v.isAdmin || c.created_by === v.meId || c.assignees.includes(v.meId) : groupEdit,
  };
}

const isDoneList = (l?: ListRow) => l?.name.toLowerCase() === "done";

/** Keyboard moving: ←/→ jump to the neighbouring list, ↑/↓ move within a list. */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
    event.preventDefault();
    const rect = args.context.collisionRect;
    if (!rect) return undefined;
    const cols = [...document.querySelectorAll<HTMLElement>("[data-board-list]")]
      .map((el) => el.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    const cx = rect.left + rect.width / 2;
    const i = cols.findIndex((r) => cx >= r.left && cx <= r.right);
    const target = cols[i + (event.code === "ArrowRight" ? 1 : -1)];
    return target ? { x: target.left + 8, y: target.top + 44 } : undefined;
  }
  return sortableKeyboardCoordinates(event, args);
};

export function Board({ data, viewer }: { data: BoardData; viewer: Viewer }) {
  const t = useTranslations("board");
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const rights = boardRights(data.board, viewer);
  const dndId = useId(); // stable ids so server and browser HTML match

  const [lists, setLists] = useState(data.lists);
  const [cards, setCards] = useState<Record<string, BoardCard>>(() => Object.fromEntries(data.cards.map((c) => [c.id, c])));
  const [order, setOrder] = useState<Record<string, string[]>>(() => buildOrder(data.lists, data.cards));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get("card"));
  const dragging = useRef(false);

  // Fresh data from the server (someone else changed something) → adopt it, unless mid-drag.
  useEffect(() => {
    if (dragging.current) return;
    setLists(data.lists);
    setCards(Object.fromEntries(data.cards.map((c) => [c.id, c])));
    setOrder(buildOrder(data.lists, data.cards));
  }, [data]);

  const sensors = useSensors(
    // Mouse: drag after moving 6px. Touch: press and hold, so swiping still scrolls the board.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 260, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );

  const containerOf = (id: string) => (order[id] ? id : Object.keys(order).find((k) => order[k].includes(id)));

  function onDragStart(e: DragStartEvent) {
    dragging.current = true;
    navigator.vibrate?.(8); // a small tick on Android when the card lifts
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    setOrder((prev) => {
      const fromItems = prev[from].filter((id) => id !== active.id);
      const toItems = [...prev[to]];
      const overIndex = toItems.indexOf(String(over.id));
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, String(active.id));
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    setActiveId(null);
    const over = e.over ? String(e.over.id) : null;
    const listId = containerOf(id);
    if (!over || !listId) { dragging.current = false; return; }

    let ids = order[listId];
    const oldIndex = ids.indexOf(id);
    const overIndex = ids.indexOf(over);
    if (overIndex >= 0 && overIndex !== oldIndex) ids = arrayMove(ids, oldIndex, overIndex);
    setOrder((prev) => ({ ...prev, [listId]: ids }));

    const idx = ids.indexOf(id);
    const prevPos = idx > 0 ? cards[ids[idx - 1]]?.position : undefined;
    const nextPos = idx < ids.length - 1 ? cards[ids[idx + 1]]?.position : undefined;
    const position =
      prevPos !== undefined && nextPos !== undefined ? (prevPos + nextPos) / 2 :
      prevPos !== undefined ? prevPos + 1 :
      nextPos !== undefined ? nextPos - 1 : 1;

    const card = cards[id];
    if (card.list_id === listId && card.position === position) { dragging.current = false; return; }
    const doneNow = isDoneList(lists.find((l) => l.id === listId));
    setCards((c) => ({ ...c, [id]: { ...card, list_id: listId, position, completed_at: doneNow ? card.completed_at ?? new Date().toISOString() : null } }));
    const { error } = await supabase.from("cards").update({ list_id: listId, position }).eq("id", id);
    dragging.current = false;
    if (error) { toast("error", t("errors.save")); router.refresh(); }
    else if (data.board.trello_sync_enabled) pushToTrello({ cardId: id, op: "upsert" });
  }

  async function addCard(listId: string, title: string) {
    const ids = order[listId];
    const last = ids.length ? cards[ids[ids.length - 1]]?.position ?? 0 : 0;
    // Show the card instantly; the person adding it is its creator and first assignee
    const id = crypto.randomUUID();
    const card: BoardCard = {
      id, board_id: data.board.id, list_id: listId, title, description: null, due_at: null, completed_at: null,
      position: last + 1, labels: [], created_by: viewer.meId, created_at: new Date().toISOString(),
      assignees: [viewer.meId], checklist: { done: 0, total: 0 }, comments: 0,
    };
    setCards((c) => ({ ...c, [id]: card }));
    setOrder((o) => ({ ...o, [listId]: [...o[listId], id] }));
    const { error } = await supabase.from("cards")
      .insert({ id, board_id: data.board.id, list_id: listId, title, position: last + 1, created_by: viewer.meId });
    if (error) {
      setOrder((o) => ({ ...o, [listId]: o[listId].filter((x) => x !== id) }));
      return toast("error", t("errors.save"));
    }
    await supabase.from("card_assignees").insert({ card_id: id, user_id: viewer.meId });
    if (data.board.trello_sync_enabled) pushToTrello({ cardId: id, op: "upsert" });
  }

  // A template = one project card (assigned to you) with its small tasks, in the first list
  async function applyTemplate(title: string, items: string[]) {
    const listId = lists[0]?.id;
    if (!listId) return;
    const ids = order[listId];
    const last = ids.length ? cards[ids[ids.length - 1]]?.position ?? 0 : 0;
    const id = crypto.randomUUID();
    const { error } = await supabase.from("cards").insert({ id, board_id: data.board.id, list_id: listId, title, position: last + 1, created_by: viewer.meId });
    if (error) return toast("error", t("errors.save"));
    await supabase.from("card_assignees").insert({ card_id: id, user_id: viewer.meId });
    await supabase.from("card_checklist_items").insert(items.map((text, i) => ({ card_id: id, text, position: i + 1 })));
    const card: BoardCard = { id, board_id: data.board.id, list_id: listId, title, description: null, due_at: null, completed_at: null, position: last + 1,
      labels: [], created_by: viewer.meId, created_at: new Date().toISOString(), assignees: [viewer.meId], checklist: { done: 0, total: items.length }, comments: 0 };
    setCards((c) => ({ ...c, [id]: card }));
    setOrder((o) => ({ ...o, [listId]: [...o[listId], id] }));
    setOpenId(id);
  }

  async function addList(name: string) {
    const position = (lists.at(-1)?.position ?? 0) + 1;
    const { data: row, error } = await supabase.from("board_lists").insert({ board_id: data.board.id, name, position }).select("*").single();
    if (error || !row) return toast("error", t("errors.save"));
    setLists((l) => [...l, row]);
    setOrder((o) => ({ ...o, [row.id]: [] }));
  }

  async function renameList(id: string, name: string) {
    setLists((l) => l.map((x) => (x.id === id ? { ...x, name } : x)));
    const { error } = await supabase.from("board_lists").update({ name }).eq("id", id);
    if (error) toast("error", t("errors.save"));
  }

  async function deleteList(id: string) {
    if (order[id]?.length) return toast("error", t("errors.listNotEmpty"));
    setLists((l) => l.filter((x) => x.id !== id));
    const { error } = await supabase.from("board_lists").delete().eq("id", id);
    if (error) { toast("error", t("errors.save")); router.refresh(); }
  }

  function onCardChange(card: BoardCard | null, id: string) {
    if (card === null) {
      setCards((c) => { const n = { ...c }; delete n[id]; return n; });
      setOrder((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.filter((x) => x !== id)])));
      setOpenId(null);
    } else {
      const prevList = cards[id]?.list_id;
      setCards((c) => ({ ...c, [id]: card }));
      if (prevList && prevList !== card.list_id) {
        setOrder((o) => ({ ...o, [prevList]: o[prevList].filter((x) => x !== id), [card.list_id]: [...(o[card.list_id] ?? []), id] }));
      }
    }
  }

  const activeCard = activeId ? cards[activeId] : null;
  const openCard = openId ? cards[openId] : null;

  return (
    <div>
      {!rights.canAdd ? (
        <div className="mb-3"><ViewOnlyBadge /></div>
      ) : (
        <div className="mb-2 flex justify-end"><TemplateMenu onUse={applyTemplate} /></div>
      )}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners}
                  onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
                  onDragCancel={() => { dragging.current = false; setActiveId(null); router.refresh(); }}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:snap-none lg:px-0">
          {lists.map((list) => (
            <Column key={list.id} list={list} ids={order[list.id] ?? []} cards={cards} members={data.members}
                    rights={rights} onOpen={setOpenId} onAdd={addCard}
                    onRename={renameList} onDelete={deleteList} />
          ))}
          {rights.canEditLists && <AddList onAdd={addList} />}
        </div>
        <DragOverlay>
          {activeCard ? <CardTile card={activeCard} members={data.members} done={isDoneList(lists.find((l) => l.id === activeCard.list_id))} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {viewer.isAdmin && <TrelloPanel board={data.board} members={data.members} />}

      {openCard && (
        <CardDialog card={openCard} lists={lists} members={data.members} groupId={data.board.group_id} viewerId={viewer.meId} trello={data.board.trello_sync_enabled}
                    canEdit={rights.canEditCard(openCard)} onClose={() => setOpenId(null)} onChange={onCardChange} />
      )}
    </div>
  );
}

function buildOrder(lists: ListRow[], cards: BoardCard[]) {
  const o: Record<string, string[]> = Object.fromEntries(lists.map((l) => [l.id, [] as string[]]));
  [...cards].sort((a, b) => a.position - b.position).forEach((c) => o[c.list_id]?.push(c.id));
  return o;
}

function Column({ list, ids, cards, members, rights, onOpen, onAdd, onRename, onDelete }: {
  list: ListRow; ids: string[]; cards: Record<string, BoardCard>; members: Member[];
  rights: ReturnType<typeof boardRights>;
  onOpen: (id: string) => void; onAdd: (listId: string, title: string) => void;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const t = useTranslations("board");
  const listName = useListName();
  const { setNodeRef, isOver } = useDroppable({ id: list.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const done = isDoneList(list);

  return (
    <section data-board-list className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-[14px] bg-surface-2/60 sm:w-72 xl:w-auto xl:max-w-none xl:min-w-[230px] xl:flex-1">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        {editing ? (
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onRename(list.id, name.trim()); setEditing(false); }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setEditing(false)}
                   className="input py-1" aria-label={t("listName")} />
          </form>
        ) : (
          <h3 className="flex-1 text-sm font-semibold">{listName(list.name)}</h3>
        )}
        <span className="text-xs text-muted tabular-nums">{ids.length}</span>
        {rights.canEditLists && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} aria-label={t("listMenu")} className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink">
              <MoreHorizontal size={16} />
            </button>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-line bg-surface p-1 text-sm shadow-lg" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => { setEditing(true); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <Pencil size={14} /> {t("rename")}
                </button>
                <button onClick={() => { onDelete(list.id); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-bad-text hover:bg-surface-2">
                  <Trash2 size={14} /> {t("deleteList")}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <SortableContext id={list.id} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`flex min-h-16 flex-1 flex-col gap-2 px-2 pb-2 transition ${isOver ? "rounded-xl bg-surface-2" : ""}`}>
          {ids.map((id) => cards[id] && (
            <SortableCard key={id} card={cards[id]} members={members} done={done}
                          disabled={!rights.canEditCard(cards[id])} onOpen={() => onOpen(id)} />
          ))}
          {!ids.length && !adding && (
            <p className="px-2 py-4 text-center text-xs text-muted">{rights.canAdd ? t("emptyListCanAdd") : t("emptyList")}</p>
          )}
        </div>
      </SortableContext>

      {rights.canAdd && (
        <div className="px-2 pb-2">
          {adding ? (
            <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) { onAdd(list.id, title.trim()); setTitle(""); } }}>
              <textarea autoFocus value={title} onChange={(e) => setTitle(e.target.value)} rows={2}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (title.trim()) { onAdd(list.id, title.trim()); setTitle(""); } }
                          if (e.key === "Escape") setAdding(false);
                        }}
                        placeholder={t("cardTitlePlaceholder")} className="input resize-none" />
              <div className="mt-2 flex gap-2">
                <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast">{t("addCard")}</button>
                <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink">{t("cancel")}</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink">
              <Plus size={15} /> {t("addCard")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}


function SortableCard({ card, members, done, disabled, onOpen }: {
  card: BoardCard; members: Member[]; done: boolean; disabled: boolean; onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
         className={`rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${isDragging ? "opacity-40" : ""}`}
         {...attributes} {...listeners}
         onClick={onOpen}
         // Enter opens the card; Space picks it up to move with the arrow keys (dnd-kit)
         onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onOpen(); } else listeners?.onKeyDown?.(e); }}>
      <CardTile card={card} members={members} done={done} />
    </div>
  );
}

export function CardTile({ card, members, done, dragging }: { card: BoardCard; members: Member[]; done: boolean; dragging?: boolean }) {
  const t = useTranslations("board");
  const locale = useLocale();
  const overdue = !!card.due_at && !done && Date.parse(card.due_at) < Date.now();
  const people = card.assignees.map((id) => members.find((m) => m.id === id)).filter(Boolean) as Member[];

  return (
    <article suppressHydrationWarning style={{ boxShadow: dragging ? "var(--shadow-lift)" : "var(--shadow), inset 0 0 0 1px var(--panel-edge)" }}
      className={`no-select relative cursor-grab touch-manipulation rounded-[10px] bg-surface p-3 text-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-px active:cursor-grabbing ${
      dragging ? "-rotate-2 scale-[1.03]" : ""}`}>
      {overdue && <span aria-hidden className="absolute top-3 right-3 size-2 rounded-full bg-bad" />}
      {card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">{card.labels.map((l) => <LabelChip key={l} label={l} />)}</div>
      )}
      <p className={`leading-snug ${done ? "text-muted line-through decoration-muted/50" : ""}`}>{card.title}</p>
      {card.checklist.total > 0 && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${(card.checklist.done / card.checklist.total) * 100}%` }} />
        </div>
      )}
      {(card.due_at || card.checklist.total > 0 || card.comments > 0 || people.length > 0) && (
        <div className="mt-2.5 flex items-center gap-2.5 text-xs text-muted">
          {card.due_at && (
            <span suppressHydrationWarning className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-bad-text" : ""}`}>
              <Calendar size={12} /> {shortDate(card.due_at, locale)}{overdue ? ` · ${t("overdue")}` : ""}
            </span>
          )}
          {card.checklist.total > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums"><CheckSquare size={12} />{card.checklist.done}/{card.checklist.total}</span>
          )}
          {card.comments > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums"><MessageSquare size={12} />{card.comments}</span>
          )}
          <span className="ml-auto flex -space-x-1.5">
            {people.slice(0, 3).map((p) => (
              <span key={p.id} className="rounded-full ring-2 ring-surface"><Avatar name={p.full_name} src={p.avatar_url} size={20} /></span>
            ))}
          </span>
        </div>
      )}
    </article>
  );
}

function AddList({ onAdd }: { onAdd: (name: string) => void }) {
  const t = useTranslations("board");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="w-[82vw] max-w-[300px] shrink-0 snap-start sm:w-72 xl:w-56">
      {open ? (
        <form className="rounded-2xl bg-surface-2/70 p-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(""); setOpen(false); } }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("listName")} className="input" />
          <div className="mt-2 flex gap-2">
            <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast">{t("addList")}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted">{t("cancel")}</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="flex w-full items-center gap-1.5 rounded-2xl border border-dashed border-line px-3 py-3 text-sm text-muted hover:text-ink">
          <Plus size={15} /> {t("addList")}
        </button>
      )}
    </div>
  );
}
