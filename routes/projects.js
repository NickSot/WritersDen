var express = require('express');
var router = express.Router();
var db = require("../config/database");

const booksOnPage = 30;

router.get('/:page', function(req, res, next) {
    let offset = req.params.page * 10;
    let query = "Select * from Books WHERE authorId = ? order by Rating desc LIMIT " + booksOnPage + " OFFSET " + offset;

    db.query(query, [req.session.userId], (err, result) => {
        if(err) throw err;

        if(result > 0){
            res.render('projects', {books : result});
        }else{
            req.flash('error', "No masterpieces yet...");
            res.redirect('/');
        }

    });

});

module.exports = router;