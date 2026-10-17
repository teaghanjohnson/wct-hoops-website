// empties the saved cart after a successful payment. lives in its own file because _headers blocks inline scripts
try { localStorage.removeItem("wctCart"); } catch (e) {}
