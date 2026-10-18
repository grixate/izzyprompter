defmodule TeleprompterWeb.LibraryController do
  use TeleprompterWeb, :controller
  alias Teleprompter.Library
  import TeleprompterWeb.AccountAuth, only: [require_user: 2]
  plug :require_user
  plug TeleprompterWeb.AccountWriteBudget

  def index(conn, params) do
    page =
      case Integer.parse(if(is_binary(params["page"]), do: params["page"], else: "0")) do
        {n, ""} when n in 0..10000 -> n
        _ -> 0
      end

    json(conn, %{
      scripts:
        Library.list_summaries(
          conn.assigns.current_user,
          if(is_binary(params["q"]), do: String.slice(params["q"], 0, 200), else: ""),
          params["trash"] == "true",
          page
        )
    })
  end

  def show(conn, %{"id" => id}) do
    case Library.get(conn.assigns.current_user, id) do
      nil -> TeleprompterWeb.AccountController.error(conn, :not_found)
      script -> json(conn, Library.serialize(script))
    end
  end

  def create(conn, params), do: respond(conn, Library.create(conn.assigns.current_user, params))

  def update(conn, %{"id" => id} = params),
    do: respond(conn, Library.update(conn.assigns.current_user, id, params))

  def duplicate(conn, %{"id" => id}),
    do: respond(conn, Library.duplicate(conn.assigns.current_user, id))

  def delete(conn, %{"id" => id}), do: respond(conn, Library.trash(conn.assigns.current_user, id))

  def restore(conn, %{"id" => id}),
    do: respond(conn, Library.restore(conn.assigns.current_user, id))

  def presets(conn, _), do: json(conn, %{presets: Library.presets(conn.assigns.current_user)})

  def save_preset(conn, params),
    do: respond(conn, Library.save_preset(conn.assigns.current_user, params["id"], params))

  def delete_preset(conn, %{"id" => id}),
    do: respond(conn, Library.delete_preset(conn.assigns.current_user, id))

  def start_session(conn, %{"id" => id} = params),
    do:
      respond(
        conn,
        Teleprompter.Sessions.create_saved(
          conn.assigns.current_user,
          id,
          params["preset_id"],
          params["speed"]
        )
      )

  def end_session(conn, %{"id" => id}) do
    case Teleprompter.SavedSessions.lookup(id) do
      {:ok, session_id} ->
        case Teleprompter.Sessions.end_saved(session_id, conn.assigns.current_user) do
          :ok -> json(conn, %{ended: true})
          {:error, reason} -> TeleprompterWeb.AccountController.error(conn, reason)
        end

      :none ->
        json(conn, %{ended: true})
    end
  end

  def apply_preset(conn, %{"id" => id, "preset_id" => preset_id}) do
    with {:ok, settings} <- Library.preset_settings(conn.assigns.current_user, preset_id),
         {:ok, session_id} <- Teleprompter.SavedSessions.lookup(id) do
      respond(
        conn,
        Teleprompter.Sessions.apply_preset(session_id, conn.assigns.current_user, settings)
      )
    else
      :none -> TeleprompterWeb.AccountController.error(conn, :not_found)
      {:error, reason} -> TeleprompterWeb.AccountController.error(conn, reason)
    end
  end

  def apply_preset(conn, _), do: TeleprompterWeb.AccountController.error(conn, :invalid_preset)

  defp respond(conn, {:ok, value}), do: json(conn, value)
  defp respond(conn, {:error, reason}), do: TeleprompterWeb.AccountController.error(conn, reason)
end
