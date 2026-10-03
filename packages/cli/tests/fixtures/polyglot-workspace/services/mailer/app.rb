class Mailer
  def self.call(_env)
    [200, {}, [ENV.fetch("BILLING_URL", "unset")]]
  end
end
