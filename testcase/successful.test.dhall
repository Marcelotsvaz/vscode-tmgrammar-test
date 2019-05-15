-- SYNTAX TEST "source.dhall" 
-- simple test


{- Don't repeat yourself!

   Repetition is error-prone
-}


let user = "bill" 
--        ^ - string.quoted.double.dhall 
--               ^ - string.quoted.double.dhall
in  { home       = "/home/${user}"
-- <~~~~- keyword.operator.record.begin.dhall - foo
    , privateKey = "/home/${user}/id_ed25519"
--    ^^^^^^^^^^ source.dhall meta.declaration.data.record.block.dhall  variable.object.property.dhall
--               ^ source.dhall meta.declaration.data.record.block.dhall meta.declaration.data.record.literal.dhall punctuation.separator.dictionary.key-value.dhall
--                 ^^^^^^^^^^^^^^^^^^^^^^^^^^ source.dhall string.quoted.double.dhall
    , publicKey  = "/home/${user}/id_ed25519.pub"
--                        ^^^^^^^ constant.other.placeholder.dhall
--                          ^^^^   meta.label.dhall   
}
-- <- keyword.operator.record.end.dhall
 -- comment
-- <~- comment.line.double-dash.dhall - meta.declaration.data.record.block.dhall





