defmodule TeleprompterWeb.ProductController do
  use TeleprompterWeb, :controller

  def show(conn, _),
    do:
      conn |> put_resp_header("cache-control", "no-store") |> json(Teleprompter.Product.public())

  # A remote capability permits appearance for this take, never account access.
  # Grant lookup runs outside the playback GenServer.
  # Authorization belongs to staging's Basic-auth proxy. Keep the capability
  # in the body, covered by Phoenix's deny-by-default parameter log filter.
  def appearance(conn, %{"id" => id} = params) do
    token = params["token"]

    case Teleprompter.Sessions.appearance_owner(id, token) do
      {:ok, user} ->
        json(conn |> put_resp_header("cache-control", "no-store"), %{
          pro: not is_nil(user) and Teleprompter.Commerce.pro?(user)
        })

      _ ->
        conn |> put_status(401) |> json(%{reason: "appearance_unavailable"})
    end
  end
end
