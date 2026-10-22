defmodule TeleprompterWeb.FeedbackControllerTest do
  use TeleprompterWeb.ConnCase, async: false
  alias Teleprompter.{Repo, Accounts}
  @moduletag :database
  setup do
    sandbox = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    old = Application.get_env(:teleprompter, :feedback_enabled)
    Application.put_env(:teleprompter, :feedback_enabled, true)

    on_exit(fn ->
      Application.put_env(:teleprompter, :feedback_enabled, old)
      Ecto.Adapters.SQL.Sandbox.stop_owner(sandbox)
    end)

    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    %{user: user}
  end

  test "feedback requires sign-in, binds the owner, and has no public inbox", %{
    conn: conn,
    user: user
  } do
    params = %{
      "request_id" => Ecto.UUID.generate(),
      "category" => "idea",
      "message" => "Synthetic idea from the owner.",
      "user_id" => Ecto.UUID.generate()
    }

    assert conn |> post("/api/account/feedback", params) |> json_response(401) == %{
             "reason" => "login_required"
           }

    signed =
      conn |> init_test_session(account_token: Accounts.issue_token(user.id, "session", 3600))

    assert signed |> post("/api/account/feedback", params) |> json_response(200) == %{
             "received" => true
           }

    [entry] = Teleprompter.Feedback.inbox()
    assert entry.user_id == user.id

    assert signed
           |> put_req_header("x-izzy-account-id", Ecto.UUID.generate())
           |> post("/api/account/feedback", params)
           |> json_response(409) == %{"reason" => "account_changed"}

    assert conn |> get("/api/account/feedback") |> json_response(404) == %{
             "errors" => %{"detail" => "Not Found"}
           }

    Application.put_env(:teleprompter, :feedback_enabled, false)

    assert signed |> post("/api/account/feedback", params) |> json_response(503) == %{
             "reason" => "feedback_unavailable"
           }
  end
end
