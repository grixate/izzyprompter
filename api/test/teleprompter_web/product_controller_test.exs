defmodule TeleprompterWeb.ProductControllerTest do
  use TeleprompterWeb.ConnCase, async: false

  setup do
    old = Application.get_env(:teleprompter, :launch_offer_active, true)
    on_exit(fn -> Application.put_env(:teleprompter, :launch_offer_active, old) end)
    :ok
  end

  test "public offer has no account/purchase data and shares the new-checkout price", %{
    conn: conn
  } do
    Application.put_env(:teleprompter, :launch_offer_active, true)
    data = conn |> get("/api/product") |> json_response(200)
    assert data["price_minor"] == Teleprompter.Commerce.options().prices["USD"]
    assert data["price_minor"] == 2900
    assert data["reference_price_minor"] == 4900
    assert data["discount_percent"] == 40
    refute Map.has_key?(data, "purchases")
    refute Map.has_key?(data, "user")
    assert length(data["skins"]) == 16
  end

  test "ending the promotion changes both prices and removes the discount", %{conn: conn} do
    Application.put_env(:teleprompter, :launch_offer_active, false)
    data = conn |> get("/api/product") |> json_response(200)
    assert data["price_minor"] == 4900
    assert data["discount_percent"] == 0
    refute data["launch_offer"]
    assert Teleprompter.Commerce.options().prices["USD"] == 4900
  end

  test "appearance requires this session's remote capability and reveals no identity", %{
    conn: conn
  } do
    {:ok, session} = Teleprompter.Sessions.create("Synthetic script", 1)
    path = "/api/sessions/#{session.session_id}/appearance"

    assert conn |> post(path, %{}) |> json_response(401) == %{
             "reason" => "appearance_unavailable"
           }

    rejected =
      build_conn()
      |> post(path, %{"token" => session.tokens["editor"]})

    assert rejected.status == 401

    data =
      build_conn()
      |> put_req_header("authorization", "Basic c3ludGhldGljOnByZXZpZXc=")
      |> post(path, %{"token" => session.tokens["remote"]})
      |> json_response(200)

    assert data == %{"pro" => false}
    assert {:ok, snapshot} = Teleprompter.Sessions.snapshot(session.session_id)
    assert snapshot.presence == %{"editor" => 0, "display" => 0, "remote" => 0}
  end

  test "login return targets are allowlisted and contain no capabilities" do
    assert Teleprompter.Product.return_to("/pro") == "/pro"
    purchase = "/account?purchase=6fef5a2e-3403-489c-bbbc-64a63b270621"
    assert Teleprompter.Product.return_to(purchase) == purchase
    assert is_nil(Teleprompter.Product.return_to(purchase <> "&status=success"))
    assert is_nil(Teleprompter.Product.return_to("/account?purchase=anything"))
    assert Teleprompter.Product.return_to("/skins?skin=ivory") == "/skins?skin=ivory"

    for target <- [
          "//evil.example",
          "https://evil.example",
          "/remote/ABCDEF#key=anything",
          "/skins?skin=ivory&next=anything",
          "/skins?skin=unknown"
        ] do
      assert is_nil(Teleprompter.Product.return_to(target))
    end
  end

  test "an expired Google return preserves the safe purchase destination for email fallback" do
    target = "/account?purchase=6fef5a2e-3403-489c-bbbc-64a63b270621"

    conn =
      build_conn()
      |> init_test_session(google_oauth: %{params: %{}, at: 0, user_id: nil, return_to: target})
      |> get("/auth/google/callback", %{})

    query = conn |> redirected_to() |> URI.parse() |> Map.fetch!(:query) |> URI.decode_query()
    assert query["returnTo"] == target
    assert query["error"] == "google_login_failed"
  end
end
