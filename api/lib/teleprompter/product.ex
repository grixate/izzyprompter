defmodule Teleprompter.Product do
  @moduledoc "Public product facts and the server-owned price used by new checkout."
  @skins ~w(original ivory field graphite signal groove switchboard vector cartridge correspondent foundry clear arcade observatory)
  def skins, do: @skins
  def free_script_limit, do: 3
  def return_to(value) when value in ["/pro", "/skins"], do: value
  def return_to("/skins?skin=" <> id = value), do: if(id in @skins, do: value, else: nil)

  def return_to("/account?purchase=" <> id = value),
    do: if(Regex.match?(~r/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/, id), do: value)

  def return_to(_), do: nil
  def launch?, do: Application.get_env(:teleprompter, :launch_offer_active, true)
  def price, do: if(launch?(), do: 2_900, else: 4_900)

  def public do
    %{
      id: "lifetime_pro",
      name: "Izzy Pro",
      currency: "USD",
      price_minor: price(),
      reference_price_minor: 4_900,
      discount_percent: div((4_900 - price()) * 100, 4_900),
      launch_offer: launch?(),
      checkout_available:
        Teleprompter.Accounts.enabled?() and
          Teleprompter.Commerce.Provider.enabled?("lava", "USD"),
      free_script_limit: free_script_limit(),
      skins: @skins,
      features: %{
        skins: true,
        unlimited_account_scripts: true,
        presets: true,
        standalone_offline: true,
        paired_offline: "experimental"
      }
    }
  end
end
